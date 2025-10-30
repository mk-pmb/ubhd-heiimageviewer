// src/ImageViewer.js
import { Collection, View } from 'ol';
import OlMap from 'ol/Map.js';
import { OverviewMap, ZoomSlider } from 'ol/control.js';
import {
  defaults as defaultInteractions,
  MouseWheelZoom,
} from 'ol/interaction.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import ImageLayer from 'ol/layer/Image.js';
import Static from 'ol/source/ImageStatic.js';
import { Projection } from 'ol/proj.js';
import { containsCoordinate, getCenter, intersects } from 'ol/extent.js';
import { IIIFInfo } from 'ol/format.js';
import { IIIF } from 'ol/source.js';
import TileLayer from 'ol/layer/Tile.js';

import './hei-image-viewer.css';

import {
  CenterMapControl,
  MyFullScreen,
  MyZoom,
  RotateControl,
  WheelControl,
} from './controls.js';
import { fade } from './fade.js';
import { visibilityBaseStyle, visibilityStrongStyle } from './Layer.js';
import i18n from './transl.js';
import parseShapes from './parseShapes.js';
import variables from './variables.js';

/**
 * Module for the Image Viewer
 * @module heiImageViewer
 * */

/** @class
 *@classdesc Main class for the viewer.
 * */
class ImageBase {
  heiViewerLayers = [];

  imageLayers = [];

  maxZoom = 8;
  /**
   * Create and instance of the viewer on an HTML element.
   * @param {String} name - The name of the viewer, in case it needs
   *   to be identified.
   * @param {Array} images - An array of the string URL that the
   *   viewer uses for different sizes.
   * @param {Array} sizes - An array of arrays with the width and
   *   height of each image. There should be an array of sizes pro
   *   image.
   * @param {HTMLElement} container - The DOM Element where the
   *   viewer will be hooked.
   * @param {Object} annotations - The vector zones to be displayed
   *   on the viewer, for line alignment, ocr, etc. Each annotation
   *   is an array with the keys *name* and *coordinates*. Each
   *   annotation will be transformed into an ol.Feature. The *name*
   *   is the main identifier for this feature. The *coordinates*
   *   are the points that define the polygon and must have the
   *   structure of a list of paired values. Each pair represents a
   *   point and is separated by whitespace. The x and y coordinates
   *   of the point are separated by a comma.: [100,200 500,344]
   * @param {String} position - The starting value for the position
   *   of the image. Possible values are 'center', 'top' and
   *   'top-left'.
   * @param {String} zoom - The starting value for the zoom on the
   *   image. Possible values are 'min' (see the whole image) and
   *   'cover' (the image is zoomed so to the minimum level that
   *   covers the whole canvas).
   * @param {Number} overviewMapSize - The size of the overview map
   *   in pixels. Default is 150.
   * @param {String} lang - Language for the menu options. 'en' or
   *   'de'. Default 'de'.
   * @param {String} properties - Contains the properties
   *   'resolution', 'wheelMode' and 'rotation' that can be
   *   optionally given at the start.
   * @param {Boolean} autoSize - If set to true, the width of the
   *   container will be preserved, and the image will fit perfectly
   *   in it. The height of the container will be automatically
   *   computed, so that the image fills it completely. In this case
   *   the parameter "zoom" will be irrelevant. If
   *   "properties.resolution" is set, that will override this
   *   behaviour
   * @param {Number} maxCoordinateDecimals - How many decimals to
   *   consider and save in the coordinates for vector zones
   */

  static reqiredParams = ['container', 'images'];

  constructor(params) {
    const origProperties = this.properties;
    Object.assign(this, params);
    this.properties = Object.assign(origProperties || {}, this.properties);
    this.name = this.name || 'heiImageViewer'
                + Math.random().toString(36).slice(2);
    this.position = this.position || variables.POSITION_DEFAULT;
    this.zoom = this.zoom || variables.ZOOM_MIN;
    this.overviewMapSize = this.overviewMapSize || 150;
    this.wheelMode = this.properties.wheelMode || variables.MW_ZOOM;
    this.rotation = +this.properties.rotation || 0;
    this.resolution = this.properties.resolution ?? null;
    this.overviewMapCollapsed = !!this.properties.overviewMapCollapsed;
    this.maxCoordinateDecimals = Math.max(
      0, +this.maxCoordinateDecimals || 0);

    /* Check that all essential parameters have been passed and are ok */
    const missingParams = this.constructor.reqiredParams
      .filter(k => !this[k])
      .join(', ');
    if (missingParams) {
      throw new Error('Missing required parameter(s): ' + missingParams);
    }

    /* Construct Map */
    this.map = new OlMap({
      interactions: defaultInteractions({
        mouseWheelZoom: false,
        dragPan: false,
      }),
      controls: [],
    });
    this.map.set('heiv', this);
  }

  async #fetchIIIFInfo(imageInfoUrl) {
    try {
      const response = await fetch(imageInfoUrl);
      const imageInfo = await response.json();
      const iiifOptions = new IIIFInfo(imageInfo).getTileSourceOptions();

      if (iiifOptions === undefined || iiifOptions.version === undefined) {
        console.warn('Data seems to be no valid IIIF image information.');
        return;
      }

      const iiifTileSource = new IIIF(iiifOptions);
      this.maxZoom = iiifTileSource.getTileGrid().getMaxZoom() + 1;
      this.overviewLayer = new TileLayer({
        source: iiifTileSource,
      });
      this.extent = iiifTileSource.getTileGrid().getExtent();
      this.projection = new Projection({
        code: 'inverted',
        units: 'pixels',
        extent: this.extent,
      });
      const imgLayer = new TileLayer();
      imgLayer.setSource(iiifTileSource);
      return imgLayer;
    } catch (error) {
      console.warn('Could not read data from URL: ' + error);
    }
  }

  async initialize() {
    const { images } = this;
    /* IIIF ? */
    if (images.length === 1 && images[0].endsWith('info.json')) {
      const imageInfoUrl = images[0];
      return this.#fetchIIIFInfo(imageInfoUrl).then((imgLayer) => {
        this.imageLayers.push(imgLayer);
        this.createViewer();
      });
    }
    /* NORMAL IMG URL */
    if (this.sizes === null || this.sizes === undefined) {
      this.sizes = await this.#checkSizes();
    }
    try {
      if (this.sizes.length !== images.length) {
        throw new Error('Image and size array lengths do not match');
      }
    } catch (e) {
      console.error('The sizes and images arrays must be the same length');
      return;
    }

    /* Sort the images from smallest to biggest */
    const zipped = images.map((url, index) => ({
      url,
      size: this.sizes[index],
    }));
    zipped.sort((a, b) => a.size[0] - b.size[0]);
    this.images = zipped.map(item => item.url);
    this.sizes = zipped.map(item => item.size);
    const bigImg = this.sizes.slice(-1);
    const imageWidth = bigImg[0][0];
    const imageHeight = bigImg[0][1];

    const extent = [0, -imageHeight, imageWidth, 0]; // Format to get 0,0 at top left corner
    this.extent = extent;
    const projection = new Projection({
      code: 'inverted',
      units: 'pixels',
      extent,
    });
    this.projection = projection;

    /* Create Image Layers */
    for (let i = 0; i < this.images.length; i += 1) {
      const source = new Static({
        url: this.images[i],
        projection,
        imageExtent: extent,
      });
      if (i === 0) {
        this.overviewLayer = new ImageLayer({
          source,
        });
      }
      const imgLayer = new ImageLayer({
        source,
        minZoom: i - 0.1,
        zIndex: i,
      });
      this.imageLayers.push(imgLayer);
    }
    return this.createViewer();
  }

  fail(why) {
    if (!why.message) {
      this.fail({ message: why });
    }
    const self = this;
    const err = Object.assign(new Error(why.message), why, {
      getAffectedInstance() {
        return self;
      },
    });
    throw err;
  }

  async #checkSizes() {
    const promises = this.images.map(url => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const imgSize = [img.naturalWidth, img.naturalHeight];
        resolve(imgSize);
      };
      img.onerror = err => reject(err);
      img.src = url;
    }));
    return Promise.all(promises);
  }

  createViewer() {
    /* Set global css properties for the overview map and zoom slider
       based on the desired size */
    document.documentElement.style.setProperty(
      '--overview-map-size',
      this.overviewMapSize + 'px',
    );
    document.documentElement.style.setProperty(
      '--slider-left',
      this.overviewMapSize + 5 + 'px',
    );
    const { map } = this;
    map.setLayers([...this.imageLayers]);

    /* Make the container a div inside the once selected by the user */
    const containerSub = document.createElement('div');
    containerSub.style.backgroundColor = '#666666';
    containerSub.style.width = '100%';
    containerSub.style.height = '100%';
    this.container.appendChild(containerSub);
    map.setTarget(containerSub);
    this.container = containerSub;

    /* Initial View */
    const initialView = this.createInitialView(this.resolution);
    map.setView(initialView);

    let overviewMapTimer;
    let zoomslideTimer;
    let prevPos;

    /* INTERACTIONS */
    const selfObject = this;
    const variableWheel = new MouseWheelZoom({
      condition(e) {
        if (e.type !== 'wheel') {
          return;
        }
        if (selfObject.wheelMode === variables.MW_VERTICAL) {
          e.originalEvent.preventDefault();
          const view = map.getView();
          const center = view.getCenter();
          const variation = 50;
          if (e.originalEvent.deltaY < 0) {
            view.setCenter([center[0], center[1] + variation]);
          }
          if (e.originalEvent.deltaY > 0) {
            view.setCenter([center[0], center[1] - variation]);
          }
          prevPos = null;
          return false;
        }
        const coord = map.getCoordinateFromPixel(e.pixel);
        return !!containsCoordinate(selfObject.extent, coord);
      },
    });
    const interactions = map.getInteractions();
    interactions.extend([variableWheel]);

    /* CONTROLS */
    /* Basic Controls for all subclasses */
    this.controls = [
      new MyFullScreen(),
      new ZoomSlider(),
      new RotateControl(),
      new CenterMapControl({ extent: this.extent }),
      new MyZoom({
        delta: 0.5,
        imageExtent: this.extent,
      }),
    ];
    this.controls.forEach((ctrl) => {
      this.map.addControl(ctrl);
    });
    this.updateControls(this.lang);

    /* OVERVIEW MAP CONTROL */

    const overviewResolution = Math.max(
      Math.abs(this.extent[1]),
      Math.abs(this.extent[2]),
    ) / this.overviewMapSize;
    const overviewMapControl = new OverviewMap({
      className: 'ol-overviewmap ol-custom-overviewmap',
      layers: [this.overviewLayer],
      label: i18n.buttonIconAndLabel('overviewMapVisible', 'span'),
      collapseLabel: i18n.buttonIconAndLabel('overviewMapHidden', 'span'),
      tipLabel: i18n('overviewMapVisible'),
      collapsed: this.overviewMapCollapsed,
      view: new View({
        projection: this.projection,
        resolutions: [overviewResolution],
        extent: this.extent,
        constrainResolution: true,
      }),
    });
    this.overviewMapControl = overviewMapControl;
    map.addControl(overviewMapControl);
    /* still handling overview map... */
    const overvmap = this.container.getElementsByClassName(
      'ol-custom-overviewmap',
    )[0];
    const overviewCanvas = overvmap.querySelector('.ol-overviewmap-map');
    const overviewButton = overvmap.querySelector('button');
    const zoomslider = this.container.getElementsByClassName(
      'ol-zoomslider',
    )[0];

    function overviewPreserve() {
      clearTimeout(overviewMapTimer);
      clearTimeout(zoomslideTimer);
      overviewCanvas.style.visibility = 'visible';
      overviewCanvas.style.opacity = 1;
      overviewCanvas.parentElement.style.borderBottom = '1px solid black';
      overviewCanvas.parentElement.style.borderRight = '1px solid black';
      zoomslider.style.opacity = 1;
      zoomslider.style.display = 'block';
      zoomslider.style.visibility = 'visible';
    }

    zoomslider.addEventListener('mouseover', () => {
      overviewPreserve();
    });
    zoomslider.addEventListener('mouseleave', () => {
      overviewPreserve();
      overviewMapTimer = setTimeout(fade, 2500, overviewCanvas);
      zoomslideTimer = setTimeout(fade, 2500, zoomslider);
    });

    map.on('movestart', () => {
      prevPos = map.getView().getCenter();
      if (overviewMapControl.getCollapsed()) {
        return;
      }
      overviewPreserve();
    });

    map.on('moveend', () => {
      const view = map.getView();
      const mapviewport = view.calculateExtent(map.getSize());
      if (!intersects(mapviewport, this.extent)) {
        view.setCenter(prevPos);
      }
      /* Overview map reset timer */
      if (overviewMapControl.getCollapsed()) {
        return;
      }
      overviewMapTimer = setTimeout(fade, 2500, overviewCanvas);
      zoomslideTimer = setTimeout(fade, 2500, zoomslider);
    });
    overviewButton.onclick = function overviewButtonClick() {
      const isCurrentlyCollapsed = overviewMapControl.getCollapsed();
      if (!isCurrentlyCollapsed) {
        overviewPreserve();
      } else {
        overviewCanvas.style.visibility = 'hidden';
        zoomslider.style.visibility = 'hidden';
      }
    };

    overviewMapControl.getOverviewMap().on('pointerdrag', overviewPreserve);
    overviewMapControl.getOverviewMap().on('click', overviewPreserve);


    this.hoveredFeatures = [];
    this.selectedFeature = new Collection();
    this.pointerMoveRefresh();
    /* Unhighlight features when leaving canvas */
    const viewport = this.map.getViewport();
    viewport.addEventListener('mouseout', () => {
      this.hoveredFeatures.forEach((feat) => {
        this.unhighlightFeature(feat.id_); // eslint-disable-line no-underscore-dangle
      });
      this.hoveredFeatures = [];
    });

    /* Initial state setup */
    this.listeners = {};
    this.#createChangeEvents();
    this.updateInteractions();

    /* Return the viewer */
    map.set('heiv', this);
  }

  pointerMoveRefresh() {
    const { selectedFeature } = this;
    const selfObject = this;
    this.map.on('pointermove', (e) => {
      for (let i = 0; i < this.hoveredFeatures.length; i += 1) {
        const hoveredFeature = this.hoveredFeatures[i];
        if (hoveredFeature !== null) {
          let isSelected = false;
          selectedFeature.forEach((sf) => {
            // eslint-disable-next-line no-underscore-dangle
            if (hoveredFeature.id_ === sf.id_) {
              isSelected = true;
            }
          });
          if (isSelected !== true) {
            const { color } = hoveredFeature.get('properties');
            const correspLayerName = hoveredFeature.get('properties').layerName;
            const correspLayer = selfObject.#findFeatureLayer(
              correspLayerName,
            )[0];
            const { display } = correspLayer;
            hoveredFeature.setStyle(visibilityBaseStyle(display, color));
          }
        }
      }
      this.hoveredFeatures = [];
      this.map.forEachFeatureAtPixel(
        e.pixel,
        function handleFeature(f) {
          if (f.id_ === undefined) { // eslint-disable-line no-underscore-dangle
            return;
          }
          let isSelected = false;
          selectedFeature.forEach((sf) => {
            // eslint-disable-next-line no-underscore-dangle
            if (f.id_ === sf.id_) {
              isSelected = true;
            }
          });
          if (isSelected === true) {
            return;
          }
          const { color } = f.get('properties');
          const correspLayerName = f.get('properties').layerName;
          const correspLayer = selfObject.#findFeatureLayer(
            correspLayerName,
          )[0];
          const { display } = correspLayer;
          f.setStyle(visibilityStrongStyle(display, color));
          selfObject.hoveredFeatures.push(f);
        },
        { hitTolerance: 5 },
      );
    });
  }

  #createChangeEvents() {
    this.map.getView().on('change', () => {
      this.triggerEvent('change:view');
    });
    this.map.getView().on('change:rotation', () => {
      this.triggerEvent('change:view');
    });
    const selfO = this;
    this.map.getControls().forEach((c) => {
      if (c instanceof WheelControl || c instanceof OverviewMap) {
        c.element.addEventListener('click', () => {
          selfO.triggerEvent('change:view');
        });
      }
    });
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  triggerEvent(event, data = null) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        callback(data);
      });
    }
  }

  /**
   * Adds a Hover Listener
   * @param {function} inFeature - Enter feature.
   * @param {function} outFeature - Leave feature.
   * */
  addHoverListener(inFeature, outFeature) {
    let enterF = [];
    let leaveF = [];
    const { map } = this;
    map.on('pointermove', function onPointerMove(e) {
      const featuresAtPixel = map.getFeaturesAtPixel(e.pixel);
      const numFeat = featuresAtPixel.length;
      for (let i = 0; i < numFeat; i += 1) {
        const f = featuresAtPixel[i];
        if (!enterF.includes(f)) {
          enterF.push(f);
          inFeature(f);
        }
      }
      leaveF = enterF.filter(x => !featuresAtPixel.includes(x));
      for (let i = 0; i < leaveF.length; i += 1) {
        const f = leaveF[i];
        outFeature(f);
        // eslint-disable-next-line no-underscore-dangle
        enterF = enterF.filter(x => x.id_ !== f.id_);
      }
      leaveF = [];
    });
  }

  /**
   * Adds a Click Listener
   * @param {function} clickFunction - Enter feature.
   * */
  addClickListener(clickFunction) {
    const { map } = this;
    map.on('click', function onClick(e) {
      const featuresAtPixel = map.getFeaturesAtPixel(e.pixel);
      for (let i = 0; i < featuresAtPixel.length; i += 1) {
        const f = featuresAtPixel[i];
        clickFunction(f);
      }
    });
  }

  createInitialView(initialResolution = null) {
    const size = this.map.getSize();
    const canvasWidth = size[0];
    const canvasHeight = size[1];
    const { projection } = this;
    const extent = projection.extent_; // eslint-disable-line no-underscore-dangle
    const imageWidth = extent[2];
    const imageHeight = Math.abs(extent[1]);
    const self = this;
    const w = imageWidth / canvasWidth;
    const h = imageHeight / canvasHeight;
    const fullResolution = Math.max(w, h);
    this.map.set('fullResolution', fullResolution);
    if (initialResolution === null || initialResolution === undefined) {
      initialResolution = (() => {
        switch (self.zoom) {
          case variables.ZOOM_COVER:
            return Math.min(w, h);
          case variables.ZOOM_MIN:
            return fullResolution;
          default:
            return fullResolution;
        }
      })();
    }
    return this.initialView(
      extent,
      initialResolution,
      fullResolution,
      projection,
      imageWidth,
      imageHeight,
      canvasWidth,
      canvasHeight,
    );
  }

  /**
   *  CENTER THE MAP ACCORDING TO POSITION SETTING */
  initialView(
    extent,
    initialResolution,
    fullResolution,
    projection,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
  ) {
    let mapCenter;
    switch (this.position) {
      case variables.POSITION_DEFAULT:
        mapCenter = getCenter(extent);
        break;
      case variables.POSITION_TOP:
        mapCenter = [
          imageWidth / 2,
          (-canvasHeight * initialResolution) / 2,
        ];
        break;
      case variables.POSITION_TOP_LEFT:
        mapCenter = [
          imageWidth / 2
            + ((canvasWidth * initialResolution) / 2 - imageWidth / 2),
          -((canvasHeight * initialResolution) / 2),
        ];
        break;
      default:
        console.warn(
          'The setting for the center of the image is invalid: "'
            + this.position
            + '". Using the default behaviour.',
        );
        mapCenter = getCenter(extent);
    }
    const viewExtent = [
      -(canvasWidth + imageWidth) * fullResolution,
      -(canvasHeight + imageHeight) * fullResolution,
      (canvasWidth + imageWidth) * fullResolution,
      (canvasHeight + imageHeight) * fullResolution,
    ];
    return new View({
      projection,
      center: mapCenter,
      maxResolution: fullResolution * 1.2,
      resolution: initialResolution,
      maxZoom: this.maxZoom,
      extent: viewExtent,
      zoomFactor: 1.5,
      rotation: this.rotation,
    });
  }

  /**
   * Reset the view, for example after a resize
   * */
  resetView() {
    const { map } = this;
    const view = map.getView();
    const mapSize = map.getSize();
    if (mapSize === '0,0') {
      /* When the map was not visible, the size is 0,0 and we need
         to calculate it as if it was opened for the first time */
      map.updateSize();
      const newView = this.createInitialView(this.resolution);
      map.setView(newView);
    } else {
      const oldViewRotation = view.getRotation();
      const oldMapExtent = view.calculateExtent(mapSize);
      map.updateSize();
      const newMapExtent = view.calculateExtent(map.getSize());
      const mapCenter = view.getCenter();
      const moved = [
        oldMapExtent[0] - newMapExtent[0],
        oldMapExtent[3] - newMapExtent[3],
      ];
      const destView = this.createInitialView(view.getResolution());
      map.setView(destView);
      const newView = map.getView();
      newView.setRotation(oldViewRotation);
      newView.setCenter([mapCenter[0] + moved[0], mapCenter[1] + moved[1]]);
    }
    this.#createChangeEvents();
  }

  /**
   * Regenerates all menus except the overview map. Usually to
   * update the language.
   * */
  updateControls() {
    // Nothing to do in this base class.
  }

  #findFeatureLayer(name) {
    this.map.getLayers();
    const found = this.heiViewerLayers.filter(x => x.getName() === name);
    return found;
  }

  /** Get the feature and the layer object
   * @param {string} id - The feature ID.
   * @return {Feature} - The feature
   * */
  getFeatureAndLayer(id) {
    const layers = this.heiViewerLayers;
    for (let i = 0; i < layers.length; i += 1) {
      const layer = layers[i];
      const f = layer.getMapLayer().getSource().getFeatureById(id);
      if (f !== null && f !== undefined){
        return [f, layer];
      }
    }
    return false;
  }

  /** Get the feature and the layer object, throw an Error if not found.
   * @param {string} id - The feature ID.
   * @return {Feature} - The feature
   * */
  mustGetFeatureAndLayer(id) {
    return (
      this.getFeatureAndLayer(id)
      || this.fail({
        message: 'Could not find a feature with id ' + id,
        name: 'ERR_HEIIMAGEVIEWER_FEATURE_ID_NOT_FOUND',
        featureId: id,
      })
    );
  }

  /**
   * @param {Object} feature - The feature object with keys 'name'
   *   and 'shapes', optionally 'color'.
   * @param {Object} layer - The layer to add the feature to.
   */
  addFeature(feature, layer) {
    layer.features.push(feature);
    this.deleteLayer(layer.name);
    this.addLayer(layer);
  }

  /**
   * @param {string} id
   */
  deleteFeature(id) {
    const [f, layer] = this.getFeatureAndLayer(id);
    layer.mapLayer.getSource().removeFeature(f);
    let { features } = layer;
    features = features.filter(obj => obj.name !== id);
    layer.features = features;
  }

  /** Changes color for feature
   * @param {string} id - The feature ID.
   * @param {string} color - The color as a hex number or array with
   *   three numbers for rgb
   * */
  changeFeatureColor(id, color) {
    const [f, layer] = this.getFeatureAndLayer(id);
    f.get('properties').color = color;
    const { display } = layer;
    f.setStyle(visibilityBaseStyle(display, color));
  }

  /** Center, zoom into and highlight feature
   * @param {string} id
   */
  focusFeature(id) {
    const { map } = this;
    const [f, layer] = this.getFeatureAndLayer(id);
    const { color } = f.get('properties');
    const { display } = layer;
    const polygon = f.getGeometry();
    const view = map.getView();
    view.fit(polygon, {
      padding: [20, 20, 20, 20],
      duration: 800,
      callback() {
        setTimeout(function setStyle() {
          f.setStyle(visibilityStrongStyle(display, color, 0.3));
        }, 100);
      },
    });
  }

  /** Highlights the feature with the given ID.
   * @param {string} id - The feature ID.
   * @param {number} opacity - The desired opacity. Default is 0.3.
   * */
  highlightFeature(id, opacity = 0.3) {
    const featAndLayer = this.mustGetFeatureAndLayer(id);
    const [f, layer] = featAndLayer;
    const { color } = f.get('properties');
    const { display } = layer;
    f.setStyle(visibilityStrongStyle(display, color, opacity));
  }

  /** Removes highlight for the feature with the given ID.
   * @param {string} id - The feature ID.
   * */
  unhighlightFeature(id) {
    const featAndLayer = this.mustGetFeatureAndLayer(id);
    const [f, layer] = featAndLayer;
    const { color } = f.get('properties');
    const { display } = layer;
    f.setStyle(visibilityBaseStyle(display, color));
  }

  /**
   * @param {string} name - The name of the layer to remove. If
   *   empty all annotation layers will be removed.
   * */
  deleteLayer(name) {
    const { map } = this;
    const { heiViewerLayers } = this;
    const filteredLayers = [];
    for (let i = 0; i < heiViewerLayers.length; i += 1) {
      const current = heiViewerLayers[i];
      const layerName = current.name;
      if (layerName === name || name === null || name === undefined) {
        map.removeLayer(current.mapLayer);
        continue;
      }
      filteredLayers.push(current);
    }
    this.heiViewerLayers = filteredLayers;
  }

  /**
   * @param {string} name - The name of the layer.
   * @return {heiImageViewer/Layer}
   * */
  getLayer(name) {
    if (name === null || name === undefined) {
      console.warn('No name provided in call to getLayer().');
      return null;
    }
    const { heiViewerLayers } = this;
    for (let i = 0; i < heiViewerLayers.length; i += 1) {
      const current = heiViewerLayers[i];
      const layerName = current.name;
      if (layerName === name) {
        return current;
      }
    }
    console.warn('Could not find layer with name ' + name);
    return null;
  }

  /**
   * @param {Object} layerObj - The layer object to add to the
   *   canvas. This has the keys 'name', 'type' and 'features'.
   * */
  addLayer(layerObj, i = 0) {
    const layerType = layerObj.type;
    const layerName = layerObj.name;
    const { color } = layerObj;

    let featureCollection = [];
    if (undefined !== layerObj.features) {
      featureCollection = parseShapes(layerObj, this.projection);
    }

    const source = new VectorSource({
      features: featureCollection,
      useSpatialIndex: false,
    });

    source.forEachFeature((f) => {
      this.triggerEvent('viewer:addedFeature', f);
      const { display } = layerObj;
      const { color } = f.get('properties');
      f.setStyle(visibilityBaseStyle(display, color));
    });

    const annotationLayer = new VectorLayer({
      className: 'ol-layer ol-annotation-layer',
      properties: {
        layerType: layerType || 'undefined',
        name: layerName || `layer_${i}`,
        color,
        heivLayer: layerObj,
      },
      source,
    });

    switch (layerType) {
      case variables.FEATURE_TYPE_ANNO:
        annotationLayer.setZIndex(104);
        break;
      case variables.FEATURE_TYPE_CUSTOM:
        annotationLayer.setZIndex(105);
        break;
      case variables.FEATURE_TYPE_LINE:
        annotationLayer.setZIndex(102);
        break;
      case variables.FEATURE_TYPE_SEARCH:
        annotationLayer.setZIndex(103);
        break;
      case variables.FEATURE_TYPE_ZONE:
        annotationLayer.setZIndex(101);
        break;
      default:
        annotationLayer.setZIndex(100);
        break;
    }
    layerObj.setMapLayer(annotationLayer);
    this.heiViewerLayers.push(layerObj);
    this.map.addLayer(annotationLayer);

    return annotationLayer;
  }

  /**
   * Add more than one layer at one
   * @param {Array} annotations - An array of Layers.
   * */
  addLayers(annotations) {
    for (let i = 0; i < annotations.length; i += 1) {
      this.addLayer(annotations[i], i + 1);
    }
  }

  /**
   * Returns the corresponding [ol/Map (Open Layers Map)]
   * {@link external:ol.Map} object to be able to use its´ methods.
   * @returns {ol.Map}
   * */
  getMap() {
    return this.map;
  }

  /**
   * Get the current custom properties that change the behaviour of
   * the object, for example highlighing zones on zoom or the type
   * of mouse scroll
   * @returns {{wheelMode, resolution, rotation}}
   * @example
   * viewer.getProperties().wheelMode ;
   * */
  getProperties() {
    const map = this.getMap();
    const view = map.getView();
    return {
      wheelMode: this.wheelMode,
      resolution: view.getResolution(),
      rotation: view.getRotation(),
      overviewMapCollapsed: this.overviewMapControl.getCollapsed(),
    };
  }

  toggleWheel(type) {
    this.wheelMode = type;
  }

  /**
   * Sets the size of the container to fit image exactly */
  setContainerSize(container, imageHeight, res) {
    container.style.height = (imageHeight / res).toString() + 'px';
  }

  updateInteractions() {}
}

export { ImageBase };
