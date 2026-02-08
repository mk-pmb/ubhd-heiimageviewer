// src/ImageDraw
import { DragPan, Modify, Select, Translate } from 'ol/interaction.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { Collection } from 'ol';
import { shiftKeyOnly } from 'ol/events/condition.js';
import Transform from 'ol-ext/interaction/Transform.js';
import ImageBase from './ImageBase.js';
import variables from './variables.js';
import shapeDefs from './shapeDefs.js';
import Layer from './Layer.js';
import { DrawBase, RemoveFeature, SelectMode, ShapeTransform }
  from './controls.js';


import layerStyles from './layerStyles.js';

const { visibilityBaseStyle } = layerStyles;


const xmlNumAttrQuote = "'"; /*
  For compatibility with old heIV.
  :TODO: Check SVG compliance and maybe explain here.
  */


/** @class
 *@classdesc Class for viewer that allows to draw shape.
 * */
class ImageDraw extends ImageBase {
  constructor({ ...rest }) {
    super({ ...rest });

  }

  async initialize() {
    await super.initialize();
    /* Click and Drag Interaction */
    const self = this;
    const { map } = this;

    this.editFeature = true;
    this.freeMove = false;


    /* LEFT DRAG INTERACTION */
    const leftDrag = new DragPan({
      condition: e => true,
    });
    const container = map.getTarget();
    /* Mouse2 Drag and cancel draw */
    container.addEventListener('contextmenu', function (ev) {
      const currentDraw = map.get('draw');
      if (currentDraw) { currentDraw.abortDrawing(); }
      ev.preventDefault();
      return false;
    }, false);
    map.addInteraction(leftDrag);

    /* ESC Interaction */
    document.addEventListener('keydown', (e) => {
      if (e.key == 'Escape') {
        const currentDraw = map.get('draw');
        if (currentDraw) {
          currentDraw.abortDrawing();
        }
      }
      // else if (e.key == 'Delete') {
      //     if (this.selectedFeature.getLength() > 0){
      //         this.deleteSelectedFeatures();
      //     }
      // }
    });

    /* Create a Default Draw Layer just in case */
    const drawLayerObjDefault = new Layer({
      name: 'drawLayerDefault',
      display: variables.ZONES_SHOW_ALL,
      color: '#F00',
    });
    this.heiViewerLayers.push(drawLayerObjDefault);
    const drawLayerDefault = this.addLayer(drawLayerObjDefault);
    map.set('drawLayer', drawLayerDefault);
    const drawSource = drawLayerDefault.getSource();
    drawSource.on('addfeature', (e) => {
      this.triggerEvent('draw:end');
    });
    map.set('drawSource', drawSource);
    map.set('draw', null);


    /* SELECT, MODIFY, TRANSFORM */
    self.modifyType = 'transform';
    const selectionModifyStyle =            new Style({
      stroke: new Stroke({
        color: 'blue',
        width: 3,
      }),
      fill: new Fill({
        color: 'rgba(255,255,0, .5)',
      }),
    });
    self.selectShape = new Select({
      features: self.selectedFeature,
      style: selectionModifyStyle,
      hitTolerance: 5,
    });
    self.modifyShape = new Modify({
      features: self.selectShape.getFeatures(),
      wrapX: false,
      pixelTolerance: 5,
      insertVertexCondition: shiftKeyOnly,
    });
    self.transformShape = new Transform({
      hitTolerance: 2,
      rotate: true,
      selection: true,
      translate: true,
      addCondition: shiftKeyOnly,
    });
    self.translateShape = new Translate({
      features: self.selectShape.getFeatures(),
    });

    this.#updateControls();
    this.activateShapedit();

    /* Bind the trash icon and function to select */
    function handleSelectEvent(e) {
      const selected = e.selected || e.features.array_; /*
        Handle both event structures */
      if (selected.length > 0) {
        this.removeFeatureControl.activate();
      } else {
        this.removeFeatureControl.deactivate();
        this.selectedFeature.clear();
      }
    }
    self.selectShape.on('select', handleSelectEvent.bind(this));
    self.transformShape.on('select', handleSelectEvent.bind(this));

    const drawendTriggers = ['rotateend', 'translateend', 'scaleend'];
    drawendTriggers.forEach((event) => {
      self.transformShape.addEventListener(event, function (e) {
        self.triggerEvent('draw:end');
      });
    });
    self.modifyShape.addEventListener('modifyend', function () {
      self.triggerEvent('draw:end');
    });
  }

  activateShapedit() {
    this.shapeTransformControl.activate(this.modifyType);
  }


  #updateControls() {
    const { map } = this;
    /* Create the select controls */
    this.selectControl = new SelectMode();
    this.removeFeatureControl = new RemoveFeature();
    this.shapeTransformControl = new ShapeTransform();
    const selectControls = [
      this.selectControl,
      this.removeFeatureControl,
      this.shapeTransformControl,
    ];
    map.set('selectControls', selectControls);
    for (const sc of selectControls) {
      map.controls.push(sc);
    }

    /* Create the controls to draw each shape */
    const drawControls = [];
    for (const shp in shapeDefs) {
      const drawControl = new DrawBase({ shape: shp });
      drawControls.push(drawControl);
      map.controls.push(drawControl);
    }
    map.set('drawControls', drawControls);
  }

  addDrawLayer(layerObj) {
    const annotationLayer = this.addLayer(layerObj);
    const { map } = this;
    map.set('drawLayer', annotationLayer);
    const drawSource = annotationLayer.getSource();
    map.set('drawSource', drawSource);
    drawSource.on('addfeature', (e) => {
      this.triggerEvent('draw:end');
    });
  }


  deselectAll() {
    this.selectedFeature.forEach((feat) => {
      if (feat.id_) {
        feat.setStyle(visibilityBaseStyle(variables.ZONES_SHOW_ALL,
          feat.get('properties').color));
      }
    });
    this.selectedFeature.clear();
    this.selectCounter = 0;
    this.pointerMoveRefresh();
  }


  deleteSelectedFeatures() {
    const removedFeatures = [];
    if (this.selectedFeature.getLength() < 1) {
      const selectedTransform = this.transformShape.getFeatures().getArray();
      this.selectedFeature.extend(selectedTransform);
    }
    if (this.selectedFeature.getLength() < 1) {
      return;
    }
    const deleteConfirm = window.confirm(
      'Are you sure you want to delete this feature?');
    if (!deleteConfirm) {
      return;
    }
    this.selectedFeature.forEach((feat) => {
      const featureCopy = { ...feat };
      removedFeatures.push(featureCopy);
      this.deleteFeature(feat.id_);
    });
    this.selectedFeature.clear();
    this.transformShape.setSelection(new Collection());
    this.pointerMoveRefresh();
    this.removeFeatureControl.deactivate();
    this.triggerEvent('draw:end');
    return removedFeatures;
  }


  getLayerSvg(name) {
    if (name == null) {
      console.warn('No name provided in call to getLayerSvg().');
      return;
    }
    for (let i = 0; i < this.heiViewerLayers.length; i++) {
      const current = this.heiViewerLayers[i];
      const layerName = current.name;
      if (layerName != name) {
        continue;
      }
      const mapLayer = current.getMapLayer();
      let layerSvg = '';
      const self = this;

      mapLayer.getSource().forEachFeature(function (feature) {
        const geom = feature.getGeometry();
        const geoType = feature.get('properties').type;
        const subFeatures = feature.get('properties').subfeatures;
        layerSvg += self.processFeature(geom, geoType, subFeatures);
      });

      if (layerSvg) {
        layerSvg = ('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
          + 'width="' + this.extent[2] + '">' + layerSvg + '</svg>');
      }
      return layerSvg;
    }
    console.warn(`No layer found with name: ${name}`);
  }

  processFeature(geom, geoType, subfeatures) {
    let processed = '';
    switch (geoType) {
      case 'rect':
        const rectCoords = geom.getCoordinates();
        const rectSvg = this.createSvgRect(rectCoords);
        processed += rectSvg;
        break;
      case 'polygon':
        const polygonCoords = geom.getCoordinates();
        const polygonSvg = this.createSvgPolygon(polygonCoords);
        processed += polygonSvg;
        break;
      case 'circle':
        const center = geom.getCenter();
        const radius = geom.getRadius();
        const circleSvg = this.createSvgCircle(center, radius);
        processed += circleSvg;
        break;
      case 'ellipse':
        const ellipseCoords = geom.getCoordinates();
        const ellipseSvg = this.createSvgEllipse(ellipseCoords);
        processed += ellipseSvg;
        break;
      case 'line':
        const lineCoords = geom.getCoordinates();
        const lineSvg = this.createSvgLine(lineCoords);
        processed += lineSvg;
        break;
        /* case 'polyline':
                const polylineCoords = geom.getCoordinates();
                const polyLineSvg = this.createSvgPolyline(polylineCoords);
                processed += polyLineSvg;
                break */
      case 'collection':
        const geometries = geom.geometries_;
        if (geometries) {
          for (let i = 0; i < geometries.length; i++) {
            const subGeo = geometries[i];
            const subGeoType = subfeatures[i];
            processed += this.processFeature(subGeo, subGeoType);
          }
        }
      default:
        break;
    }
    return processed;
  };


  fmtCoordinatesAsSvg(origPointsList) {
    const prec = this.maxCoordinateDecimals;
    const commaPairs = origPointsList.map(function fmtPoint([origX, origY]) {
      const x = origX.toFixed(prec);
      const y = (-origY).toFixed(prec);
      return x + ',' + y;
    });
    return commaPairs.join(' ');
  }

  createSvgPolygon(coordinates) {
    const points = this.fmtCoordinatesAsSvg(coordinates[0]);
    const svgPolygon = `<polygon points='${points}'/>`;
    return svgPolygon;
  }

  createSvgPolyline(coordinates) {
    const points = this.fmtCoordinatesAsSvg(coordinates);
    const svgPolyline = `<polyline points='${points}'/>`;
    return svgPolyline;
  }


  fmtSvgNumAttrs(attrib) {
    const prec = this.maxCoordinateDecimals;
    return Object.keys(attrib).sort().map(k => (k + '=' + xmlNumAttrQuote
      + attrib[k].toFixed(prec) + xmlNumAttrQuote)).join(' ');
  }

  createSvgLine(coordinates) {
    if (coordinates.length > 2) {
      return this.createSvgPolyline(coordinates);
    }
    const attr = {
      x1: coordinates[0][0],
      y1: -coordinates[0][1],
      x2: coordinates[1][0],
      y2: -coordinates[1][1],
    };
    return ('<line ' + this.fmtSvgNumAttrs(attr) + '>');
  }


  createSvgRect(coordinates) {
    const flattened = coordinates[0];
    // Separate x and y values
    const xValues = flattened.map(point => point[0]);
    const yValues = flattened.map(point => -point[1]); // Inverting y values

    // Calculate the top-left corner, width, and height
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const width = xMax - xMin;
    const height = yMax - yMin;

    // Create SVG <rect> element
    const attr = { x: xMin, y: yMin, width, height };
    return ('<rect ' + this.fmtSvgNumAttrs(attr) + '>');
  }

  createSvgCircle(center, radius) {
    const attr = { cx: center[0], cy: -center[1], r: radius };
    return ('<circle ' + this.fmtSvgNumAttrs(attr) + '>');
  }


  createSvgEllipse(ellipseCoords) {
    /* :TODO: Explain: What is this algorithm meant to do?
      Are we trying to find the average center point of multiple ellipses? */
    let totalX = 0;
    let totalY = 0;
    let maxRx = 0;
    let maxRy = 0;
    const numPoints = ellipseCoords[0].length;
    ellipseCoords[0].forEach((point) => {
      totalX += point[0];
      totalY += point[1];
    });
    const cx = totalX / numPoints;
    const cy = totalY / numPoints;
    ellipseCoords[0].forEach((point) => {
      const dx = Math.abs(point[0] - cx);
      const dy = Math.abs(point[1] - cy);
      if (dx > maxRx) maxRx = dx;
      if (dy > maxRy) maxRy = dy;
    });
    const rx = maxRx;
    const ry = maxRy;
    const attr = { cx, cy: -cy, rx, ry };
    return ('<ellipse ' + this.fmtSvgNumAttrs(attr) + '>');
  }
}


const EX = function createShapeEditor(how) {
  // The purpose of exporting a factory instead of a constructor is
  // to grant us more freedom of implementation in future versions.
  const draw = new ImageDraw(how);
  return draw;
};


EX.internals = Object.bind(null, {
  ImageDraw,
});


export default EX;
