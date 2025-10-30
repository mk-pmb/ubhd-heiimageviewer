import { addCoordinateTransforms, Projection } from 'ol/proj.js';
import { Circle, GeometryCollection, LineString, Polygon } from 'ol/geom.js';
import { Collection, Feature } from 'ol';
import { fromCircle } from 'ol/geom/Polygon.js';
import { getWidth, getHeight } from 'ol/extent.js';


function parseSvg(svg) {
  const parser = new DOMParser();
  const svgXml = parser.parseFromString(svg, 'text/xml');
  return svgXml;
}

function getPointCoordsFromPrimitive(points, divisor) {
  const coordClusters = points.split(' ');
  const coordinates = [];
  coordClusters.forEach((item) => {
    const xy = item.split(',');
    const x = Number(xy[0]) / divisor;
    const y = Number(xy[1]) / divisor;
    coordinates.push([x, y]);
  });
  return coordinates;
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
  const points = poly.getAttribute('points');
  const coordinates = getPointCoordsFromPrimitive(points, divisor);
  const obj = new Polygon([coordinates]);
  return obj;
}

function convertLine(line, divisor) {
  // The svg line-Element contains only two points (line start and end);
  // if more points are used, see function convertPolyline().
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
  // The svg polyline-Element contains two or more points which together
  // form a single line. If separate lines are to be connected to a
  // single shape, see ...XXX
  const points = polyline.getAttribute('points');
  const coordinates = getPointCoordsFromPrimitive(points, divisor);
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


function convertTeiSource(source, coordDivisor = 1) {
  const divisor = Number(coordDivisor);
  const coordinates = [getPointCoordsFromPrimitive(source, divisor)];
  return [new Polygon(coordinates)];
}

function convertSvgSource(source, imgWidth, coordDivisor = 1) {
  const divisor = Number(coordDivisor);
  const svgPrimitiveContainers = source.children[0].children;
  const svgPrimitiveTypes = [];
  const svgWidth = source.children[0].getAttribute('width');
  const scaleFactor = imgWidth / svgWidth;
  const svgGeometry = [];
  Array.from(svgPrimitiveContainers).forEach((svgPrimitiveContainer) => {
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
  });
  return [svgGeometry, svgPrimitiveTypes];
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

function createFeatures(feat, layerType, imgWidth, color = '#f00', layerName) {
  const featOptions = {};
  const multiFeature = feat.multiFeature ? feat.multiFeature : false;
  featOptions.featName = feat.name;
  featOptions.layerName = layerName;
  featOptions.layerType = layerType;
  featOptions.color = feat.color ? feat.color : color;
  const { shapes } = feat;
  const allGeometriesInThisFeature = [];
  let allTypesInThisFeature = [];
  for (let i = 0; i < shapes.length; i += 1) {
    const shape = shapes[i];
    const { format } = shape;
    let { source } = shape;
    let geometry;
    switch (format) {
      case 'svg':
        if (typeof source === 'string') {
          source = parseSvg(source);
        }
        [geometry, allTypesInThisFeature] = convertSvgSource(source, imgWidth);
        break;
      case 'tei':
        geometry = convertTeiSource(source);
        break;
      default:
        console.warn(
          `Invalid format for features: "${format}"`,
        );
        break;
    }
    allGeometriesInThisFeature.push(geometry);
  }
  const geometries = allGeometriesInThisFeature.flat();

  const result = [];
  if (geometries.length > 1) {
    if (multiFeature) {
      featOptions.featureGeometry = new GeometryCollection(geometries);
      featOptions.featureType = 'collection';
      const feature = createSingleFeature(featOptions);
      result.push(feature);
    } else {
      for (let i = 0; i < geometries.length; i += 1) {
        featOptions.featureGeometry = geometries[i];
        featOptions.featureType = allTypesInThisFeature[i];
        featOptions.featName += '_' + i;
        const feature = createSingleFeature(featOptions);
        result.push(feature);
      }
    }
  } else {
    featOptions.featureGeometry = geometries[0];
    featOptions.featureType = allTypesInThisFeature[0];
    const feature = createSingleFeature(featOptions);
    result.push(feature);
  }
  return result;
}

export default (annotations, projection) => {
  const featuresOrig = annotations.features;
  const layerType = annotations.type;
  const layerName = annotations.name;
  const imgWidth = projection.extent_[2];
  const { color } = annotations;
  /* Neccesary to move feature coordinates from bottom to top */
  const invertedProjection = new Projection({});
  addCoordinateTransforms(projection, invertedProjection,
    function invertCoordinate(coordinate) {
      return [coordinate[0], -coordinate[1]];
    },
    function invertCoordinateBack(coordinate) {
      return [coordinate[0], -coordinate[1]];
    });
  const features = [];
  for (let i = 0; i < featuresOrig.length; i += 1) {
    const feats = createFeatures(featuresOrig[i], layerType, imgWidth, color, layerName);
    feats.forEach((featureElement) => {
      const geometry = featureElement.getGeometry();
      geometry.transform(projection, invertedProjection);
      features.push(featureElement);
    });
  }
  return new Collection(features);
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
  if (!geometry) {
    geometry = polygon;
  } else {
    geometry.setCoordinates(polygon.getCoordinates());
  }
  return geometry;
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
    minRadius = Math.sqrt(Math.max.apply(Math, sqDistances)) / 3;
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
