import { Collection, Feature } from 'ol';
import { Circle, GeometryCollection, LineString, Polygon } from 'ol/geom.js';
import { fromCircle } from 'ol/geom/Polygon';
import { addCoordinateTransforms, Projection } from 'ol/proj.js';

/** This is the main function to parse the vector shapes to be displayed in the map.
 * It creates the Feature Collection to add to the source.
 * @param {Array} annotations - Annotations object
 * @return {Collection<Feature>} */
export default (annotations, projection) => {
  const featuresOrig = annotations.features;
  const layerType = annotations.type;
  const layerName = annotations.name;
  const img_width = projection.extent_[2];
  const { color } = annotations;
  /* Neccesary to move feature coordinates from bottom to top */
  const invertedProjection = new Projection({});
  addCoordinateTransforms(projection, invertedProjection,
    function (coordinate) {
      return [coordinate[0], -coordinate[1]];
    },
    function (coordinate) {
      return [coordinate[0], -coordinate[1]];
    });
  const features = [];
  for (let i = 0; i < featuresOrig.length; i++) {
    const feats = createFeatures(featuresOrig[i], layerType, img_width, color, layerName);
    for (const featureElement of feats) {
      const geometry = featureElement.getGeometry();
      geometry.transform(projection, invertedProjection);
      features.push(featureElement);
    }
  }
  return new Collection(features);
};


function createFeatures(feat, layerType, img_width, color = '#f00', layerName) {
  const feat_options = {};
  const multiFeature = feat.multiFeature ? feat.multiFeature : false;
  feat_options.featName = feat.name;
  feat_options.layerName = layerName;
  feat_options.layerType = layerType;
  feat_options.color = feat.color ? feat.color : color;
  const { shapes } = feat;
  const allGeometriesInThisFeature = [];
  let allTypesInThisFeature = [];
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const { format } = shape;
    let { source } = shape;
    let geometry;
    switch (format) {
      case 'svg':
        if (typeof source === 'string') {
          source = parseSvg(source);
        }
        [geometry, allTypesInThisFeature] = convertSvgSource(source, img_width);
        break;
      case 'tei':
        geometry = convertTeiSource(source);
        break;
      default:
        console.warn(`You are using an invalid format for your features to be drawn on canvas: "${format}"`);
        break;
    }
    allGeometriesInThisFeature.push(geometry);
  }
  const geometries = allGeometriesInThisFeature.flat();

  const result = [];
  if (geometries.length > 1) {
    if (multiFeature) {
      feat_options.featureGeometry = new GeometryCollection(geometries);
      feat_options.featureType = 'collection';
      const feature = createSingleFeature(feat_options);
      result.push(feature);
    } else {
      for (let i = 0; i < geometries.length; i++) {
        feat_options.featureGeometry = geometries[i];
        feat_options.featureType = allTypesInThisFeature[i];
        feat_options.featName += '_' + i;
        const feature = createSingleFeature(feat_options);
        result.push(feature);
      }
    }
  } else {
    feat_options.featureGeometry = geometries[0];
    feat_options.featureType = allTypesInThisFeature[0];
    const feature = createSingleFeature(feat_options);
    result.push(feature);
  }
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
      subfeatures: options.allTypesInThisFeature ? options.allTypesInThisFeature : '',
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

function convertSvgSource(source, img_width, coordDivisor = 1) {
  const divisor = Number(coordDivisor);
  const svgPrimitiveContainers = source.children[0].children;
  const svgPrimitiveTypes = [];
  const svgWidth = source.children[0].getAttribute('width');
  const scaleFactor = img_width / svgWidth;
  const svgGeometry = [];
  for (const svgPrimitiveContainer of svgPrimitiveContainers) {
    const svgPrimitiveType = svgPrimitiveContainer.nodeName;
    svgPrimitiveTypes.push(svgPrimitiveType);
    let geo;
    switch (svgPrimitiveType) {
      case 'rect':
        geo = convertRect(svgPrimitiveContainer, divisor);
        break;
      case 'polygon':
        geo =  convertPolygon(svgPrimitiveContainer, divisor);
        break;
      case 'line':
        geo = convertLine(svgPrimitiveContainer, divisor);
        break;
      case 'polyline':
        geo = convertPolyline(svgPrimitiveContainer, divisor);
        break;
      case 'circle':
        geo = convertCircle(svgPrimitiveContainer, divisor);
        break;
      case 'ellipse':
        geo = convertEllipse(svgPrimitiveContainer, divisor);
        break;
      default:
        console.warn('Unknown svg primitive.');
        break;
    }
    geo.scale(scaleFactor, scaleFactor, [0, 0]);
    svgGeometry.push(geo);
  }
  return [svgGeometry, svgPrimitiveTypes];
}


function convertRect(rect, divisor) {

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
}

function convertPolygon(poly, divisor) {
  const coordinates = getPointCoordsFromPrimitive(poly.getAttribute('points'), divisor);
  const obj = new Polygon([coordinates]);
  return obj;
}

function convertLine(line, divisor) {
  // The svg line-Element contains only two points (line start and end); if more points are used, see function convertPolyline().
  const x1 = Number(line.getAttribute('x1')) / divisor;
  const y1 = Number(line.getAttribute('y1')) / divisor;
  const x2 = Number(line.getAttribute('x2')) / divisor;
  const y2 = Number(line.getAttribute('y2')) / divisor;

  const obj = new LineString([
    [x1, y1],
    [x2, y2],
  ]);
  return obj;
}

function convertPolyline(polyline, divisor) {
  // The svg polyline-Element contains two or more points which together form a single line. If separate lines are to be connected to a single shape, see ...XXX
  const coordinates = getPointCoordsFromPrimitive(polyline.getAttribute('points'), divisor);
  const obj = new LineString(coordinates);
  return obj;
}

function convertCircle(circle, divisor) {

  const cx = Number(circle.getAttribute('cx')) / divisor;
  const cy = Number(circle.getAttribute('cy')) / divisor;
  const r = Number(circle.getAttribute('r')) / divisor;

  const center =  [cx, cy];
  const obj = new Circle(center, r);
  return obj;
}

function convertEllipse(ellipse, divisor = 1) {
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
}

export function ellipseGeometryFunction(coordinates, geometry) {
  const center = coordinates[0];
  const last = coordinates[1];
  const rx = center[0] - last[0];
  const ry = center[1] - last[1];
  const radius = Math.sqrt(rx * rx + ry * ry);
  const circle = new Circle(center, radius);
  const polygon = fromCircle(circle, 64);
  polygon.scale(rx / radius, ry / radius);
  if (!geometry) {
    geometry = polygon;
  } else {
    geometry.setCoordinates(polygon.getCoordinates());
  }
  return geometry;
}

function getPointCoordsFromPrimitive(points, divisor) {
  // const points = svgPrimitiveContainer.getAttribute("points");
  const coordClusters = points.split(' ');
  const coordinates = [];
  for (const item of coordClusters) {
    const xy = item.split(',');
    const x = Number(xy[0]) / divisor;
    const y = Number(xy[1]) / divisor;
    const len = coordinates.push([x, y]);
  }
  return coordinates;
}

function parseSvg(svg) {
  const parser = new DOMParser();
  const svgXml = parser.parseFromString(svg, 'text/xml');
  return svgXml;
}

export function calculateCenter(geometry) {
  let center; let coordinates; let
    minRadius;
  const type = geometry.getType();
  if (type === 'Polygon') {
    let x = 0;
    let y = 0;
    let i = 0;
    coordinates = geometry.getCoordinates()[0].slice(1);
    coordinates.forEach(function (coordinate) {
      x += coordinate[0];
      y += coordinate[1];
      i++;
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
    sqDistances = coordinates.map(function (coordinate) {
      const dx = coordinate[0] - center[0];
      const dy = coordinate[1] - center[1];
      return dx * dx + dy * dy;
    });
    minRadius = Math.sqrt(Math.max.apply(Math, sqDistances)) / 3;
  } else {
    minRadius =            Math.max(
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
