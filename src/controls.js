  // controls.js
import { containsCoordinate, getCenter } from "ol/extent";
import {Collection} from "ol";
import {Control, FullScreen, Zoom} from "ol/control";
import {Draw} from "ol/interaction";
import {noModifierKeys, primaryAction} from "ol/events/condition.js";

import {createStyle} from "./Layer.js";
import i18n from "./transl.js";

import logger from './logger.js';
import shapeDefs from './shapeDefs.js';
import variables from './variables.js';


const { clog, cwarn } = logger;


const halfPi = Math.PI / 2;
const doublePi = Math.PI * 2;


function bindEventHandler(btn, control, mtdName, ...args) {
  const hnd = control[mtdName].bind(control, ...args);
  btn.addEventListener('click', hnd, false);
}


function addRotationButton(control, clockwise) {
  const btn = document.createElement('button');
  control.element.appendChild(btn);
  /* The words "right" and "left" are duplicated on purpose in the directional
    branches, to help contributors find the full identifiers via `git grep`,
    and to help out i18n linter detect which terms are actually used. */
  if (clockwise) {
    btn.className = 'ol-rotate ol-rotate-right';
    i18n.buttonIconAndLabel('rotateRight', btn);
  } else { // counter-clockwise
    btn.className = 'ol-rotate ol-rotate-left';
    i18n.buttonIconAndLabel('rotateLeft', btn);
  }
  btn.title += '\n' + i18n('rotateFreely');
  bindEventHandler(btn, control, 'handleRotate', clockwise);
}


export class RotateControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    const element = document.createElement('div');

    super({
      element: element,
      target: options.target,
    });

    element.className = 'ol-rotate-90 ol-unselectable ol-control';
    addRotationButton(this, false);
    addRotationButton(this, true);
  }


  handleRotate(clockwise) {
    const view = this.getMap().getView();
    const rotation = view.getRotation();
    var newRotation = rotation;
    if (clockwise) {
      newRotation = rotation + halfPi;
    } else {
      newRotation = rotation - halfPi;
    }
    const absRotation = Math.abs(newRotation);
    if (absRotation > doublePi) {
      newRotation = Math.sign(newRotation) * (absRotation - doublePi);
    }
    view.setRotation(newRotation);
    if (Math.abs(newRotation) > 6.15) {
      const rotate = document.getElementsByClassName("ol-rotate-reset");
      rotate[0].click();
    }
  }
}


export class CenterMapControl extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};
    const element = document.createElement('div');

    super({
      element: element,
      target: options.target,
    });

    const btn = i18n.buttonIconAndLabel('centerInViewport');
    this.button = btn;

    element.className = "ol-centermap ol-unselectable ol-control";
    element.appendChild(btn);

    bindEventHandler(btn, this, 'centerMap', options);
  }

  centerMap(options) {
    const map = this.getMap();
    setTimeout(map.updateSize(), 200);
    const size = map.getSize();
    const view = map.getView();

    view.centerOn(getCenter(options.extent), size, [size[0] / 2, size[1] / 2]);
    /*view.setZoom(0);*/
    view.setResolution(map.get("fullResolution"));
  }
}


export class WheelControl extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};
    const initialWheelMode = options.wheelMode || variables.MW_ZOOM;
    const element = document.createElement("div");
    super({
      element: element,
      target: options.target,
    });
    const viewer = options.viewer;
    element.className = "ol-wheel ol-unselectable ol-control";
    element.style.backgroundColor = "inherit";

    const button = document.createElement("button");
    button.style.marginLeft = "auto";
    button.className = 'mousewheel-button';
    const openMenuLabel = document.createElement("span");
    button.appendChild(openMenuLabel);
    element.appendChild(button);

    function setWheelModeButtonIcon(label, mode) {
      if (mode === variables.MW_ZOOM) {
        return i18n.buttonIconAndLabel('mouseWheelZooms', label);
      }
      if (mode === variables.MW_VERTICAL) {
        return i18n.buttonIconAndLabel('mouseWheelScrolls', label);
      }
      throw new Error('setWheelModeButtonIcon: Unknown wheel mode: ' + mode);
    }
    setWheelModeButtonIcon(openMenuLabel, initialWheelMode);

    function toggleWheelMode() {
      const nextWheelMode = (viewer.wheelMode === variables.MW_ZOOM
        ? variables.MW_VERTICAL : variables.MW_ZOOM);
      viewer.toggleWheel(nextWheelMode);
      setWheelModeButtonIcon(openMenuLabel, nextWheelMode);
    }
    button.addEventListener('click', toggleWheelMode, false);
  }
}


export class myZoom extends Zoom {

  constructor(options) {
    super(options);
    this.extent = options.imageExtent;
    i18n.buttonIconAndLabel('zoomIn',
      this.element.getElementsByClassName('ol-zoom-in')[0]);
    i18n.buttonIconAndLabel('zoomOut',
      this.element.getElementsByClassName('ol-zoom-out')[0]);
  }

  approachArrays(a, b, factor) {
    if (a.length !== b.length) {
      throw new Error("Arrays must have the same length");
    }
    let difference = a.map((elementA, index) => b[index] - elementA);
    let result = a.map(
      (elementA, index) => elementA + difference[index] * factor,
    );
    return result;
  }

  zoomByDelta_(delta) {
    const map = this.getMap();
    const view = map.getView();
    if (!view) {
      // the map does not have a view, so we can't act
      // upon it
      return;
    }
    const currentZoom = view.getZoom();
    // We change the center if it's not on the image
    let center = view.getCenter();
    if (!containsCoordinate(this.extent * 0.8, center)) {
      const imageCenter = getCenter(this.extent);
      center = this.approachArrays(
        center,
        imageCenter,
        0.05 * view.getResolution(),
      );
    }
    if (currentZoom !== undefined) {
      const newZoom = view.getConstrainedZoom(currentZoom + delta);
      if (this.duration_ > 0) {
        if (view.getAnimating()) {
          view.cancelAnimations();
        }
        view.animate({
          center: center,
          zoom: newZoom,
          duration: this.duration_,
        });
      } else {
        view.setZoom(newZoom);
      }
    }
  }
}


export class myFullScreen extends FullScreen {
  constructor() {
    super();
    const btn = this.element.querySelector('.ol-full-screen button');
    i18n.buttonIconAndLabel('toggleFullScreen', btn);
  }

}


export class DrawBase extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    const shape = options.shape;
    if (!shape) { throw new Error('No shape defined for draw button'); }

    const element = document.createElement('div');
    element.className = 'heiv-draw-ind heiv-draw-inactive ol-control heiv-draw-ind-' + shape.toLowerCase();

    const shapeName = (shapeDefs[shape] || false).shortName;
    if (!shapeName) { throw new Error('Invalid shape for draw button'); }
    const button = i18n.buttonIconAndLabel(shapeName);
    const shapeNameTranslated = button.title;
    button.title = i18n('drawShape', {
      shapeNameTranslated,
      shapeNameTranslatedLower: shapeNameTranslated.toLowerCase(),
    });
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    })
    this.shape = shape;
    this.button = button;
    this.active = false;
    this.drawFeatNum = 1;

    button.addEventListener('click', (e)=>{
      const btn = e.currentTarget;
      const map = this.getMap();
      const draw = map.get("draw");
      if (draw){
        map.removeInteraction(draw);
      }
      this.active ? this.deactivate() : this.activate(shape);
      if (!this.active){
        map.set("draw", null);
        const selectControls = map.get("selectControls");
        for (const selectCtrl of selectControls) {
          selectCtrl.activate();
        }
      }
    });
  }

  activate(shape){
    const map = this.getMap()
    for (const ctrl of map.get("drawControls")) {
      ctrl.deactivate();
    }
    this.active = true;
    this.element.classList.add("heiv-draw-ind-active");
    this.drawFeatNum = this.activateDraw(shape, map, this.drawFeatNum);
    for (const selectCtrl of map.get("selectControls")) {
      selectCtrl.deactivate();
    }

  }
  deactivate(){
    this.active = false;
    this.element.classList.remove("heiv-draw-ind-active");
  }


  activateDraw(activeShape, map, drawFeatNum){
    const activeShapeDict = shapeDefs[activeShape];
    const drawSource = map.get("drawSource");
    const layer = map.get("drawLayer");
    const heiv = map.get("heiv");
    const drawType = activeShapeDict.drawType;
    const shapeType = activeShapeDict.shortName;
    heiv.deselectAll();

    const draw = new Draw({
      source: drawSource,
      type: drawType,
      geometryFunction: activeShapeDict.geometryFunction,
      stopClick: true,
      condition: (e) => noModifierKeys(e) && primaryAction(e)
    });
    draw.on("drawend", (e) => {
      drawFeatNum += 1;
      this.drawFeatNum = drawFeatNum;
      const feature = e.feature;
      const color = layer.get("color");
      const style = createStyle(color, 0.1);
      if (feature.get('modifyGeometry')){
        style.setGeometry(function (feature) {
          const modifyGeometry = feature.get('modifyGeometry');
          return modifyGeometry ? modifyGeometry.geometry : feature.getGeometry();
        })
      }
      feature.setStyle(style);
      feature.id_ = "draw_" + activeShape + '_' + drawFeatNum.toString();
      feature.set("properties", {
        color: color,
        layerName: layer.get("name"),
        type: shapeType
      });
      heiv.pointerMoveRefresh();
      /*heiv.triggerEvent('draw:end');*/
    });

    map.addInteraction(draw);
    map.set("draw", draw);
    return drawFeatNum

  }



}


export class SelectMode extends Control {
  constructor(opt_options){
    const button = i18n.buttonIconAndLabel('selectShape');
    const element = document.createElement('div');
    element.className = 'heiv-select ol-control';
    button.classList = 'heiv-select-active';
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    })

    this.button = button
    this.active = false;

    button.addEventListener('click', ()=> {
      const map = this.getMap();
      const active = !this.active;
      this.active = active;
      /* Remove draw and manage the button color and states */
      let draw = map.get("draw");
      if (draw) {
        map.removeInteraction(draw);
      }
      map.set("draw", null);

      for (const drawCtrl of map.get("drawControls")) {
        drawCtrl.deactivate()
      }

      if (!active) {
        this.deactivate()
      } else {
        this.activate();
      }

    });
  }

  activate(){
    this.active = true;
    this.button.classList.remove("heiv-select-inactive");
    this.button.classList.add("heiv-select-active");
    const map = this.getMap();
    const heiv = map.get("heiv");
    heiv.activateShapedit();
  }

  deactivate(){
    this.active = false;
    this.button.classList.add("heiv-select-inactive");
    this.button.classList.remove("heiv-select-active");
    /*this.trashElement.style.visibility = "hidden";*/

    const map = this.getMap();
    const heiv = map.get("heiv");
    heiv.deselectAll();
    heiv.shapeTransformControl.deactivate();
  }

}


export class RemoveFeature extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    const button = i18n.buttonIconAndLabel('deleteShape');
    const element = document.createElement('div');
    element.className = 'heiv-draw-ind heiv-trash heiv-trash-inactive ol-control';
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    })


    button.addEventListener('click', (e)=>{
      const map = this.getMap();
      const heiv = map.get("heiv");
      heiv.deleteSelectedFeatures();
      /*this.deactivate();*/
    })
  }

  activate(){
    this.element.classList.remove("heiv-trash-inactive");
    this.element.classList.add("heiv-trash-active");
    this.element.style.pointerEvents = 'auto'
  }

  deactivate(){
    this.element.classList.remove("heiv-trash-active");
    this.element.classList.add("heiv-trash-inactive");
  }

}


export class ShapeTransform extends Control {
  constructor(opt_options) {
    const options = opt_options || {};
    const buttonTransform = i18n.buttonIconAndLabel('moveScaleRotate');
    buttonTransform.classList.add('heiv-shapedit-transform');
    self.buttonTransform = buttonTransform;
    const buttonModify = i18n.buttonIconAndLabel('editVertices');
    buttonModify.classList.add('heiv-shapedit-modify');
    self.buttonModify = buttonModify ;
    const element = document.createElement('div');
    element.className = 'heiv-draw-ind ol-control heiv-shapedit-transform';
    element.appendChild(buttonTransform);
    element.appendChild(buttonModify);

    super({
      element: element,
      target: options.target,
    })
    this.active = false;

    bindEventHandler(buttonTransform, this, 'activate', 'transform');
    bindEventHandler(buttonModify, this, 'activate', 'modify');
  }

  activate(type){
    this.element.classList.remove('hide');
    const map = this.getMap();
    const heiv = map.get('heiv');
    if (type == 'transform'){
      map.removeInteraction(heiv.selectShape);
      map.removeInteraction(heiv.modifyShape);
      map.removeInteraction(heiv.translateShape);
      map.addInteraction(heiv.transformShape);
      heiv.transformShape.setSelection(heiv.selectedFeature);
      self.buttonTransform.classList.add('active');
      self.buttonModify.classList.remove('active');
      heiv.modifyType = 'transform';

    } else if (type == 'modify'){
      heiv.selectedFeature.extend(heiv.transformShape.getFeatures().getArray());
      map.removeInteraction(heiv.transformShape);
      map.addInteraction(heiv.modifyShape);
      map.addInteraction(heiv.selectShape);
      map.removeInteraction(heiv.translateShape);
      self.buttonModify.classList.add('active');
      self.buttonTransform.classList.remove('active');
      heiv.modifyType = 'modify';

    } else {
      clog(`Invalid value for modifyType: ${heiv.modifyType}`)
    }

  }


  deactivate(){
    const map = this.getMap();
    const heiv = map.get("heiv");
    map.removeInteraction(heiv.transformShape);
    map.removeInteraction(heiv.selectShape);
    map.removeInteraction(heiv.modifyShape);
    map.removeInteraction(heiv.translate);
    heiv.transformShape.setSelection(new Collection());
    heiv.selectedFeature.clear();
    this.element.classList.add('hide');  }
}
