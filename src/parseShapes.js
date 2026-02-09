import { addCoordinateTransforms, Projection } from 'ol/proj.js';
import { Circle, GeometryCollection, LineString, Polygon } from 'ol/geom.js';
import { Collection, Feature } from 'ol';
import { fromCircle } from 'ol/geom/Polygon.js';
import { getCenter, getWidth, getHeight } from 'ol/extent.js';
import getOwn from 'getown';

import logger from './logger.js';

const { cerr, cwarn } = logger;


function negateY(xy) { return [xy[0], -xy[1]]; }


/** This is the main function to parse the vector shapes to be displayed in
 * the map. It creates the Feature Collection to add to the source.
 * @param {Array} annotations - Annotations object
 * @return {Collection<Feature>} */
const EX = function parseShapes(annotations, projection) {
  const featuresOrig = annotations.features;
  const customFeatOpt = {
    layerType: annotations.type,
    layerName: annotations.name,
    color: annotations.color,
  };
  const imgWidth = projection.getExtent()[2];

  const invertedProjection = new Projection({}); /*
    In OpenLayers, the Y axis points up, but in SVG, it points down. */
  addCoordinateTransforms(projection, invertedProjection, negateY, negateY);
  const features = [];
  featuresOrig.forEach(function parseAndTransformFeat(origFeat) {
    const feats = createFeatures(origFeat, customFeatOpt, imgWidth);
    feats.forEach(function transformFeature(featureElement) {
      const geometry = featureElement.getGeometry();
      if (!geometry) { return; }
      geometry.transform(projection, invertedProjection);
      features.push(featureElement);
    });
  });
  return new Collection(features);
};


EX.defaultFeatureColor = '#f00';


function createFeatures(feat, customFeatOpt, imgWidth) {
  const featOptions = {
    featName: feat.name,
    layerName: '',
    layerType: '',
    ...customFeatOpt,
  };
  featOptions.color = (feat.color || featOptions.color
    || EX.defaultFeatureColor);

  function recordError(err, details) {
    Object.assign(err, recordError.traceHints, details);
    recordError.accum.push(err);
    return err;
  }
  recordError.accum = [];
  recordError.traceHints = { commonFeatureOptions: featOptions };

  const { shapes } = feat;
  const allGeometriesInThisFeature = [];
  let allTypesInThisFeature = [];
  shapes.forEach(function createOneShapeFeature(shape, shIdx) {
    recordError.traceHints.affectedShapeIdx = shIdx;
    recordError.traceHints.affectedShape = shape;
    const { format } = shape;
    let { source } = shape;
    let geometry;
    switch (format) {
      case 'svg':
        if (typeof source === 'string') {
          try {
            source = parseSvg(source);
          } catch (errParseSvg) {
            recordError(errParseSvg, { step: 'parseSvg' });
            break;
          }
        }
        try {
          [geometry, allTypesInThisFeature] = convertSvgSource(source,
            imgWidth); // :TODO: Should we append to allTypesIn… instead?
        } catch (errConvSvg) {
          recordError(errConvSvg, {
            step: 'convertSvgSource',
            parsedSvgSource: source,
          });
          break;
        }
        break;
      case 'tei':
        try {
          geometry = convertTeiSource(source);
        } catch (errConvTei) {
          recordError(errConvTei, { step: 'convertTeiSource' });
        }
        break;
      default:
        throw new Error('Unsupported feature format: ' + format);
    }
    if (!geometry) { return recordError(new Error('False-y geometry!')); }
    allGeometriesInThisFeature.push(geometry);
  });
  delete recordError.traceHints.affectedShapeIdx;
  delete recordError.traceHints.affectedShape;

  const geometries = allGeometriesInThisFeature.flat();

  const result = [];
  if (geometries.length > 1) {
    if (feat.multiFeature) {
      featOptions.featureGeometry = new GeometryCollection(geometries);
      featOptions.featureType = 'collection';
      const feature = createSingleFeature(featOptions);
      result.push(feature);
    } else {
      geometries.forEach(function convertOneGeom(origGeom, geomIdx) {
        featOptions.featureGeometry = origGeom;
        featOptions.featureType = allTypesInThisFeature[geomIdx];
        featOptions.featName += '_' + geomIdx;
        const feature = createSingleFeature(featOptions);
        result.push(feature);
      });
    }
  } else {
    featOptions.featureGeometry = geometries[0];
    featOptions.featureType = allTypesInThisFeature[0];
    const feature = createSingleFeature(featOptions);
    result.push(feature);
  }
  result.errors = (recordError.accum.length && recordError.accum);
  if (result.errors) { cwarn('createFeatures: Failures:', result.errors); }
  return result;
}


function createSingleFeature(options) {
  const feature = new Feature({
    geometry: options.featureGeometry,
    properties: {
      kind: options.layerType,
      color: options.color,
      layerName: options.layerName,
      type: options.featureType,
      subfeatures: (options.allTypesInThisFeature || ''),
    },
  });
  feature.setId(options.featName);
  return feature;
}

function convertTeiSource(source, coordDivisor = 1) {
  const divisor = Number(coordDivisor);
  const coordinates = [getPointCoordsFromPrimitive(source, divisor)];
  return [new Polygon(coordinates)];
}


const shapeConverters = {};


function convertSvgSource(source, imgWidth, coordDivisor) {
  const trace = 'convertSvgSource: ';
  const divisor = (+coordDivisor) || 1;
  if (!Number.isFinite(divisor)) {
    throw new TypeError(trace + 'Bad coordDivisor: ' + coordDivisor);
  }

  const xmlDoc = (source.documentElement || false);
  const rootTagName = String(xmlDoc.nodeName || '').toLowerCase();
  if (!rootTagName) { throw new Error(trace + 'Found no XML root node!'); }
  if (rootTagName === 'parsererror') {
    throw new Error(trace + xmlDoc.innerHTML);
  }

  const svgPrimitiveContainers = Array.from(xmlDoc.children);
  const svgPrimitiveTypes = [];
  const svgWidth = source.children[0].getAttribute('width');
  const scaleFactor = imgWidth / svgWidth;
  const svgGeometry = [];

  function softFail(why, details) {
    const err = new Error(why);
    Object.assign(err, { source, svgWidth }, details);
    cwarn(err);
    softFail.accum.push(err);
  }
  softFail.accum = [];

  svgPrimitiveContainers.forEach(function convertOneContainer(elem) {
    const tagName = elem.nodeName;
    svgPrimitiveTypes.push(tagName);
    const conv = getOwn(shapeConverters, tagName);
    if (!conv) { return softFail('Unsupported SVG primitive', { elem }); }
    const geometry = conv(elem, divisor);
    if (!geometry) {
      return softFail('Empty geometry from conversion.', { elem, geometry });
    }
    geometry.scale(scaleFactor, scaleFactor, [0, 0]);
    svgGeometry.push(geometry);
  });

  svgGeometry.errors = (softFail.accum.length && softFail.accum);
  return [svgGeometry, svgPrimitiveTypes];
}


shapeConverters.rect = function convertRect(rect, divisor) {
  const y = Number(rect.getAttribute('y')) / divisor;
  const x = Number(rect.getAttribute('x')) / divisor;
  const width = Number(rect.getAttribute('width')) / divisor;
  const height = Number(rect.getAttribute('height')) / divisor;

  const obj = new Polygon([
    [
      [x, y], // uper left corner
      [x, y + height], // lower left corner
      [x + width, y + height], // lower right corner
      [x + width, y], // upper right corner
      [x, y], // start point
    ],
  ]);
  return obj;
};


shapeConverters.polygon = function convertPolygon(poly, divisor) {
  const coordinates = getPointCoordsFromPrimitive(
    poly.getAttribute('points'), divisor);
  const obj = new Polygon([coordinates]);
  return obj;
};


shapeConverters.line = function convertLine(line, divisor) {
  /* The svg line-Element contains only two points (line start and end);
    if more points are used, see function convertPolyline(). */
  const x1 = Number(line.getAttribute('x1')) / divisor;
  const y1 = Number(line.getAttribute('y1')) / divisor;
  const x2 = Number(line.getAttribute('x2')) / divisor;
  const y2 = Number(line.getAttribute('y2')) / divisor;

  const obj = new LineString([
    [x1, y1],
    [x2, y2],
  ]);
  return obj;
};


shapeConverters.polyline = function convertPolyline(polyline, divisor) {
  /* The svg polyline-Element contains two or more points which together form
    a single line. If separate lines are to be connected to a single shape,
    see ...XXX */
  const coordinates = getPointCoordsFromPrimitive(
    polyline.getAttribute('points'), divisor);
  const obj = new LineString(coordinates);
  return obj;
};


shapeConverters.circle = function convertCircle(circle, divisor) {
  const cx = Number(circle.getAttribute('cx')) / divisor;
  const cy = Number(circle.getAttribute('cy')) / divisor;
  const r = Number(circle.getAttribute('r')) / divisor;

  const center =  [cx, cy];
  const obj = new Circle(center, r);
  return obj;
};


shapeConverters.ellipse = function convertEllipse(ellipse, divisor = 1) {
  const cx = Number(ellipse.getAttribute('cx')) / divisor;
  const cy = Number(ellipse.getAttribute('cy')) / divisor;
  const center =  [cx, cy];
  const rx = Number(ellipse.getAttribute('rx')) / divisor;
  const ry = Number(ellipse.getAttribute('ry')) / divisor;
  const r = Math.sqrt(rx * rx + ry * ry);
  const circle = new Circle(center, r);
  const obj = fromCircle(circle, 64);
  obj.scale(rx / r, ry / r);
  return obj;
};


export function ellipseGeometryFunction(coordinates, geometry) {
  const center = coordinates[0];
  const last = coordinates[1];
  const rx = center[0] - last[0];
  const ry = center[1] - last[1];
  const radius = Math.sqrt(rx * rx + ry * ry);
  const circle = new Circle(center, radius);
  const polygon = fromCircle(circle, 64);
  polygon.scale(rx / radius, ry / radius);
  if (!geometry) { return polygon; }
  geometry.setCoordinates(polygon.getCoordinates());
  return geometry;
}


function getPointCoordsFromPrimitive(points, divisor) {
  // const points = svgPrimitiveContainer.getAttribute("points");
  const coordClusters = points.split(' ');
  const coordinates = [];
  coordClusters.forEach(function splitAndDivide(pair) {
    const xy = pair.split(',');
    const x = Number(xy[0]) / divisor;
    const y = Number(xy[1]) / divisor;
    coordinates.push([x, y]);
  });
  return coordinates;
}


function parseSvg(svgStr) {
  const parser = new DOMParser();
  const svgXml = parser.parseFromString(svgStr, 'text/xml');
  return svgXml;
}


export function calculateCenter(geometry) {
  let center;
  let coordinates;
  let minRadius;
  const type = geometry.getType();
  if (type === 'Polygon') {
    let x = 0;
    let y = 0;
    let i = 0;
    coordinates = geometry.getCoordinates()[0].slice(1);
    coordinates.forEach(function sumCoordinates(coordinate) {
      x += coordinate[0];
      y += coordinate[1];
      i += 1;
    });
    center = [x / i, y / i];
  } else if (type === 'LineString') {
    center = geometry.getCoordinateAt(0.5);
    coordinates = geometry.getCoordinates();
  } else {
    center = getCenter(geometry.getExtent());
  }
  let sqDistances;
  if (coordinates) {
    sqDistances = coordinates.map(function calculateSquareDistance(coordinate) {
      const dx = coordinate[0] - center[0];
      const dy = coordinate[1] - center[1];
      return dx * dx + dy * dy;
    });
    minRadius = Math.sqrt(Math.max(...sqDistances)) / 3;
  } else {
    minRadius = Math.max(
      getWidth(geometry.getExtent()),
      getHeight(geometry.getExtent()),
    ) / 3;
  }
  return {
    center,
    coordinates,
    minRadius,
    sqDistances,
  };
}




export default EX;
