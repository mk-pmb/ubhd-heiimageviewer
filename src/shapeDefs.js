// variables.js
import {createBox} from "ol/interaction/Draw.js";
import {ellipseGeometryFunction} from "./parseShapes.js";


const shapeDefs = {
  Rectangle: {
    shortName: 'rect',
    drawType: 'Circle',
    geometryFunction: createBox()
  },
  Polygon: {
    shortName: 'polygon',
    drawType: 'Polygon',
    geometryFunction: ''
  },
  Circle: {
    shortName: 'circle',
    drawType: 'Circle',
    geometryFunction: ''
  },
  Ellipse: {
    shortName: 'ellipse',
    drawType: 'Circle',
    geometryFunction: ellipseGeometryFunction
  },
  Line: {
    shortName: 'line',
    drawType: 'LineString',
    geometryFunction: ''
  },
};

export default shapeDefs;
