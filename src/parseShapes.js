import {Collection, Feature} from "ol";
import {Circle, GeometryCollection, LineString, Polygon} from "ol/geom.js";
import {fromCircle} from 'ol/geom/Polygon';
import {addCoordinateTransforms, Projection} from "ol/proj.js";

/** This is the main function to parse the vector shapes to be displayed in the map.
 * It creates the Feature Collection to add to the source.
 * @param {Array} annotations - Annotations object
 * @return {Collection<Feature>}*/
export default (annotations,projection) => {
    const featuresOrig = annotations.features;
    const layerType = annotations.type;
    const layerName = annotations.name;
    const img_width = projection.extent_[2];
    const color = annotations.color;
    /* Neccesary to move feature coordinates from bottom to top */
    const invertedProjection = new Projection({});
    addCoordinateTransforms(projection, invertedProjection,
        function (coordinate) {
            return [coordinate[0], -coordinate[1]];
        },
        function (coordinate) {
            return [coordinate[0], -coordinate[1]];
        })
    let features = [];
    for (let i = 0; i < featuresOrig.length; i++) {
        let feats = createFeatures(featuresOrig[i], layerType, img_width, color, layerName);
        for (const featureElement of feats) {
            let geometry = featureElement.getGeometry();
            geometry.transform(projection, invertedProjection);
            features.push(featureElement);
        }
    }
    return new Collection(features);
}


function createFeatures(feat, layerType, img_width, color='#f00', layerName) {
    let feat_options = {};
    const multiFeature = feat.multiFeature ? feat.multiFeature : false;
    feat_options.featName = feat.name;
    feat_options.layerName = layerName;
    feat_options.layerType = layerType;
    feat_options.color = feat.color ? feat.color : color;
    const shapes = feat.shapes;
    let allGeometriesInThisFeature = [];
    let allTypesInThisFeature = [];
    for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        const format = shape.format;
        let source = shape.source;
        let geometry;
        switch (format){
            case "svg":
                if (typeof source == 'string'){
                    source = parseSvg(source);
                }
                [geometry, allTypesInThisFeature] = convertSvgSource(source, img_width);
                break;
            case "tei":
                geometry = convertTeiSource(source);
                break;
            default:
                console.warn(`You are using an invalid format for your features to be drawn on canvas: "${format}"`);
                break;
        }
        allGeometriesInThisFeature.push(geometry);
    }
    let geometries = allGeometriesInThisFeature.flat();

    let result = [];
    if (geometries.length > 1) {
        if (multiFeature){
            feat_options.featureGeometry = new GeometryCollection(geometries);
            feat_options.featureType = 'collection'
            const feature = createSingleFeature(feat_options);
            result.push(feature)
        } else {
            for (let i = 0; i < geometries.length; i++) {
                feat_options.featureGeometry = geometries[i];
                feat_options.featureType = allTypesInThisFeature[i];
                feat_options.featName += '_' + i
                const feature = createSingleFeature(feat_options);
                result.push(feature)
            }
        }
    } else {
        feat_options.featureGeometry = geometries[0];
        feat_options.featureType = allTypesInThisFeature[0]
        const feature = createSingleFeature(feat_options);
        result.push(feature)
    }
    return result;
}

function createSingleFeature(options){
    const feature = new Feature({
        geometry: options.featureGeometry,
        properties: {
            kind: options.layerType,
            color: options.color,
            layerName: options.layerName,
            type: options.featureType,
            subfeatures: options.allTypesInThisFeature ? options.allTypesInThisFeature : ''
        }
    })
    feature.setId(options.featName);
    return feature
}

function convertTeiSource(source, coordDivisor = 1) {
    let divisor = Number(coordDivisor);
    let coordinates = [getPointCoordsFromPrimitive(source, divisor)];
    return [new Polygon(coordinates)];
}

function convertSvgSource(source, img_width, coordDivisor = 1) {
    let divisor = Number(coordDivisor);
    let svgPrimitiveContainers = source.children[0].children;
    let svgPrimitiveTypes = [];
    const svgWidth = source.children[0].getAttribute('width');
    const scaleFactor = img_width / svgWidth;
    let svgGeometry = [];
    for (let svgPrimitiveContainer of svgPrimitiveContainers) {
        let svgPrimitiveType = svgPrimitiveContainer.nodeName;
        svgPrimitiveTypes.push(svgPrimitiveType)
        let geo;
        switch (svgPrimitiveType) {
            case "rect":
                geo = convertRect(svgPrimitiveContainer, divisor);
                break;
            case "polygon":
                geo =  convertPolygon(svgPrimitiveContainer, divisor);
                break;
            case "line":
                geo = convertLine(svgPrimitiveContainer, divisor);
                break;
            case "polyline":
                geo = convertPolyline(svgPrimitiveContainer, divisor);
                break;
            case "circle":
                geo = convertCircle(svgPrimitiveContainer, divisor);
                break;
            case "ellipse":
                geo = convertEllipse(svgPrimitiveContainer, divisor);
                break;
            default:
                console.warn("Unknown svg primitive.");
                break;
        }
        geo.scale(scaleFactor, scaleFactor, [0,0])
        svgGeometry.push(geo);
    }
    return [svgGeometry, svgPrimitiveTypes];
}


function convertRect(rect, divisor) {

    let y = Number(rect.getAttribute('y')) / divisor;
    let x = Number(rect.getAttribute('x')) / divisor;
    let width = Number(rect.getAttribute('width')) / divisor;
    let height = Number(rect.getAttribute('height')) / divisor;

    const obj = new Polygon([
        [
            [x, y], // uper left corner
            [x, y + height], // lower left corner
            [x + width, y + height], // lower right corner
            [x + width, y], // upper right corner
            [x, y] // start point
        ]
    ])
    return obj;
}

function convertPolygon(poly, divisor) {
    let coordinates = getPointCoordsFromPrimitive(poly.getAttribute("points"), divisor);
    const obj = new Polygon([coordinates])
    return obj;
}

function convertLine(line, divisor) {
    // The svg line-Element contains only two points (line start and end); if more points are used, see function convertPolyline().
    let x1 = Number(line.getAttribute("x1")) / divisor;
    let y1 = Number(line.getAttribute("y1")) / divisor;
    let x2 = Number(line.getAttribute("x2")) / divisor;
    let y2 = Number(line.getAttribute("y2")) / divisor;

    const obj = new LineString([
        [x1, y1],
        [x2, y2]
    ]);
    return obj;
}

function convertPolyline(polyline, divisor) {
    // The svg polyline-Element contains two or more points which together form a single line. If separate lines are to be connected to a single shape, see ...XXX
    let coordinates = getPointCoordsFromPrimitive(polyline.getAttribute("points"), divisor);
    const obj = new LineString(coordinates)
    return obj;
}

function convertCircle(circle, divisor) {

    const cx = Number(circle.getAttribute('cx')) / divisor;
    const cy = Number(circle.getAttribute('cy')) / divisor;
    const r = Number(circle.getAttribute('r')) / divisor;

    const center =  [cx, cy];
    const obj = new Circle(center, r)
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
    let obj = fromCircle(circle, 64);
    obj.scale(rx/r, ry/r);
    return obj;
}

export function ellipseGeometryFunction(coordinates, geometry){
    const center = coordinates[0];
    const last = coordinates[1];
    const rx = center[0] - last[0];
    const ry = center[1] - last[1];
    const radius = Math.sqrt(rx * rx + ry * ry);
    const circle = new Circle(center, radius);
    const polygon = fromCircle(circle, 64);
    polygon.scale(rx/radius, ry/radius);
    if (!geometry) {
        geometry = polygon;
    } else {
        geometry.setCoordinates(polygon.getCoordinates());
    }
    return geometry;
}

function getPointCoordsFromPrimitive(points, divisor) {
    //const points = svgPrimitiveContainer.getAttribute("points");
    let coordClusters = points.split(" ");
    const coordinates = [];
    for (let item of coordClusters) {
        let xy = item.split(",");
        let x = Number(xy[0]) / divisor;
        let y = Number(xy[1]) / divisor;
        let len = coordinates.push([x, y]);
    }
    return coordinates;
}

function parseSvg(svg) {
    const parser = new DOMParser();
    const svgXml = parser.parseFromString(svg, "text/xml");
    return svgXml
}

export function calculateCenter(geometry) {
    let center, coordinates, minRadius;
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
        minRadius =
            Math.max(
                getWidth(geometry.getExtent()),
                getHeight(geometry.getExtent()),
            ) / 3;
    }
    return {
        center: center,
        coordinates: coordinates,
        minRadius: minRadius,
        sqDistances: sqDistances,
    };
}
