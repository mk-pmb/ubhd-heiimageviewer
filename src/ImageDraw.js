// src/ImageDraw
import {DragPan, Modify, Select, Translate} from "ol/interaction";
import {ImageBase} from "./ImageBase.js";
import variables from './variables.js';
import shapeDefs from './shapeDefs.js';
import {Fill, Stroke, Style} from "ol/style.js";
import {Layer, visibilityBaseStyle} from "./Layer.js";
import {Collection} from "ol";
import {shiftKeyOnly} from "ol/events/condition.js";
import {DrawBase, RemoveFeature, SelectMode, ShapeTransform} from "./controls.js";
import Transform from "ol-ext/interaction/Transform.js";


/** @class
 *@classdesc Class for viewer that allows to draw shape.
 * */
class ImageDraw extends ImageBase {
    constructor({...rest })
    {
        super({...rest});

    }

    async initialize(){
        await super.initialize();
        /* Click and Drag Interaction*/
        const self = this;
        const map = this.map;

        this.editFeature = true;
        this.freeMove = false;


        /* LEFT DRAG INTERACTION */
        const leftDrag = new DragPan({
            condition: (e)=>{
                return true
            }
        })
        const container = map.getTarget();
        /* Mouse2 Drag and cancel draw*/
        container.addEventListener('contextmenu', function(ev) {
            const currentDraw = map.get("draw")
            if (currentDraw){currentDraw.abortDrawing();}
            ev.preventDefault();
            return false;
        }, false);
        map.addInteraction(leftDrag);

        /* ESC Interaction*/
        document.addEventListener('keydown', (e)=>{
            if (e.key == 'Escape'){
                const currentDraw = map.get("draw");
                if (currentDraw){
                    currentDraw.abortDrawing();
                }
            }
            // else if (e.key == 'Delete') {
            //     if (this.selectedFeature.getLength() > 0){
            //         this.deleteSelectedFeatures();
            //     }
            // }
        })

        /* Create a Default Draw Layer just in case */
        const draw_layer_obj_default = new Layer({
            name: 'draw_layer_default',
            display: variables.ZONES_SHOW_ALL,
            color: '#F00',
        })
        this.heiViewerLayers.push(draw_layer_obj_default);
        const draw_layer_default = this.addLayer(draw_layer_obj_default);
        map.set("drawLayer", draw_layer_default)
        const drawSource =draw_layer_default.getSource();
        drawSource.on('addfeature', (e)=>{
            this.triggerEvent('draw:end');
        });
        map.set('drawSource', drawSource);
        map.set("draw", null)


        /* SELECT, MODIFY, TRANSFORM */
        self.modifyType = "transform"
        const selectionModifyStyle =
            new Style({
                stroke: new Stroke({
                    color: 'blue',
                    width: 3
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
            features: self.selectShape.getFeatures()
        })

        this.#updateControls();
        this.activateShapedit();

        /* Bind the trash icon and function to select */
        function handleSelectEvent(e) {
            const selected = e.selected || e.features.array_; // Handle both event structures
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
        drawendTriggers.forEach(event => {
            self.transformShape.addEventListener(event, function(e){
                self.triggerEvent('draw:end');
            })
        });
        self.modifyShape.addEventListener('modifyend', function (){
            self.triggerEvent('draw:end');
        });
    }

    activateShapedit(){
        this.shapeTransformControl.activate(this.modifyType);
    }


    #updateControls(){
        const map = this.map;
        /* Create the select controls */
        this.selectControl = new SelectMode();
        this.removeFeatureControl = new RemoveFeature();
        this.shapeTransformControl = new ShapeTransform();
        const selectControls = [
            this.selectControl,
            this.removeFeatureControl,
            this.shapeTransformControl,
        ]
        map.set("selectControls", selectControls);
        for (const sc of selectControls) {
            map.controls.push(sc);
        }

        /* Create the controls to draw each shape */
        let drawControls = [] ;
        for (const shp in shapeDefs) {
            const drawControl = new DrawBase({ shape: shp });
            drawControls.push(drawControl);
            map.controls.push(drawControl);
        }
        map.set("drawControls", drawControls);
    }

    addDrawLayer(layerObj){
        const annotationLayer = this.addLayer(layerObj)
        const map = this.map;
        map.set("drawLayer", annotationLayer);
        const drawSource = annotationLayer.getSource();
        map.set("drawSource", drawSource);
        drawSource.on('addfeature', (e)=>{
            this.triggerEvent('draw:end');
        });
    }


    deselectAll(){
        this.selectedFeature.forEach((feat)=>{
            if (feat.id_){
                feat.setStyle(visibilityBaseStyle(variables.ZONES_SHOW_ALL, feat.get('properties').color))
            }
        });
        this.selectedFeature.clear();
        this.selectCounter = 0;
        this.pointerMoveRefresh();
    }


    deleteSelectedFeatures(){
        let removedFeatures = [];
        if (this.selectedFeature.getLength() < 1){
            const selectedTransform = this.transformShape.getFeatures().getArray();
            this.selectedFeature.extend(selectedTransform);
        }
        if (this.selectedFeature.getLength() < 1){
            return
        }
        const deleteConfirm = confirm("Are you sure you want to delete this feature?");
        if (!deleteConfirm){
            return
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


    getLayerSvg(name){
        if (name == null) {
            console.warn("No name provided in call to getLayerSvg().")
            return
        }
        for (let i = 0; i < this.heiViewerLayers.length; i++) {
            const current = this.heiViewerLayers[i];
            const layerName = current.name;
            if (layerName != name){
                continue
            }
            const mapLayer = current.getMapLayer();
            let layerSvg = ''
            const self = this;

            mapLayer.getSource().forEachFeature(function (feature) {
                const geom = feature.getGeometry();
                const geoType = feature.get("properties").type;
                const subFeatures = feature.get("properties").subfeatures;
                layerSvg += self.processFeature(geom, geoType, subFeatures);
            });

            if (layerSvg != ''){
                layerSvg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="'+ this.extent[2] +'">' +
                    layerSvg +
                    '</svg>'
            }
            return layerSvg
        }
        console.warn(`No layer found with name: ${name}`)
    }

    processFeature(geom, geoType, subfeatures){
        let processed = '';
        switch (geoType) {
            case 'rect':
                const rectCoords = geom.getCoordinates();
                const rectSvg = this.createSvgRect(rectCoords);
                processed += rectSvg;
                break
            case 'polygon':
                const polygonCoords = geom.getCoordinates();
                const polygonSvg = this.createSvgPolygon(polygonCoords);
                processed += polygonSvg;
                break
            case 'circle':
                const center = geom.getCenter();
                const radius = geom.getRadius();
                const circleSvg = this.createSvgCircle(center, radius);
                processed += circleSvg;
                break
            case 'ellipse':
                const ellipseCoords = geom.getCoordinates();
                const ellipseSvg = this.createSvgEllipse(ellipseCoords);
                processed += ellipseSvg;
                break
            case 'line':
                const lineCoords = geom.getCoordinates();
                const lineSvg = this.createSvgLine(lineCoords);
                processed += lineSvg;
                break
            /*case 'polyline':
                const polylineCoords = geom.getCoordinates();
                const polyLineSvg = this.createSvgPolyline(polylineCoords);
                processed += polyLineSvg;
                break*/
            case 'collection':
                const geometries = geom.geometries_;
                if (geometries){
                    for (let i = 0; i < geometries.length ; i++) {
                        let subGeo = geometries[i];
                        let subGeoType = subfeatures[i]
                        processed += this.processFeature(subGeo, subGeoType);
                    }
                }
            default:
                break
        }
        return processed
    };

    createSvgPolygon(coordinates){
        const points = coordinates[0]
            .map(coord => coord.map((item, index) => index === 1 ? (item * -1).toFixed(this.maxCoordinateDecimals) : item.toFixed(this.maxCoordinateDecimals)).join(','))
            .join(' ');
        let svgPolygon = `<polygon points='${points}'/>`
        return svgPolygon
    }

    createSvgPolyline(coordinates){
        const points = coordinates
            .map(coord => coord.map((item, index) => index === 1 ? (item * -1).toFixed(this.maxCoordinateDecimals) : item.toFixed(this.maxCoordinateDecimals)).join(','))
            .join(' ');
        let svgPolyline = `<polyline points='${points}'/>`
        return svgPolyline
    }

    createSvgLine(coordinates){
        let points = "";
        let svgLine = '';
        if (coordinates.length == 2) {
            svgLine += `<line x1='${coordinates[0][0].toFixed(this.maxCoordinateDecimals)}' y1='${-coordinates[0][1].toFixed(this.maxCoordinateDecimals)}' x2='${coordinates[1][0].toFixed(this.maxCoordinateDecimals)}' y2='${-coordinates[1][1].toFixed(this.maxCoordinateDecimals)}'/>`;
        } else {
            points = coordinates
                .map(coord => coord.map((item, index) => index === 1 ? (item * -1).toFixed(this.maxCoordinateDecimals) : item.toFixed(this.maxCoordinateDecimals)).join(','))
                .join(' ');
            svgLine += `<polyline points='${points}'/>`;
        }
        return svgLine
    }


    createSvgRect(coordinates){
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
        const svgPolygon = `<rect x='${xMin.toFixed(this.maxCoordinateDecimals)}' y='${yMin.toFixed(this.maxCoordinateDecimals)}' width='${width.toFixed(this.maxCoordinateDecimals)}' height='${height.toFixed(this.maxCoordinateDecimals)}'/>`;

        return svgPolygon
    }

    createSvgCircle(center, radius){
        let svgPolygon = `<circle cx='${center[0].toFixed(this.maxCoordinateDecimals)}' cy='${(center[1] * -1).toFixed(this.maxCoordinateDecimals)}' r='${radius.toFixed(this.maxCoordinateDecimals)}'/>`
        return svgPolygon
    }


    createSvgEllipse(ellipseCoords) {
        let totalX = 0, totalY = 0;
        let maxRx = 0, maxRy = 0;
        let numPoints = ellipseCoords[0].length;
        ellipseCoords[0].forEach(point => {
            totalX += point[0];
            totalY += point[1];
        });
        const cx = totalX / numPoints;
        const cy = totalY / numPoints;
        ellipseCoords[0].forEach(point => {
            let dx = Math.abs(point[0] - cx);
            let dy = Math.abs(point[1] - cy);
            if (dx > maxRx) maxRx = dx;
            if (dy > maxRy) maxRy = dy;
        });
        let rx = maxRx;
        let ry = maxRy;
        const svgEllipse = `<ellipse cx="${cx.toFixed(this.maxCoordinateDecimals)}" cy="${-cy.toFixed(this.maxCoordinateDecimals)}" rx="${rx.toFixed(this.maxCoordinateDecimals)}" ry="${ry.toFixed(this.maxCoordinateDecimals)}" />`
        return svgEllipse ;
    }
}

export {ImageDraw}
