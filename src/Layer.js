import {Fill, Stroke, Style} from "ol/style.js";

import variables from './variables.js';
import {hex2rgb} from "./hexToRgb.js";


class Layer{
    constructor(options){
        this.name = options.name
        this.type = options.type
        this.color = options.color ? options.color : variables.COLOR_DEFAULT
        this.features = options.features ? options.features : []
        this.display = options.display ? options.display: 'default'
        this.baseOpacity = options.baseOpacity ? options.baseOpacity: 0
        this.hoverOpacity = options.hoverOpacity ? options.hoverOpacity: 0.1
    }

    setMapLayer(l){
        this.mapLayer = l
    }
    getMapLayer(){
        return this.mapLayer
    }

    getName(){
        return this.name
    }

    getType() {
        return this.type;
    }

    getColor() {
        return this.color;
    }

    getFeatures() {
        return this.features;
    }

    setColor(color){
        this.color = color;
        let mapLayer = this.mapLayer;
        mapLayer.getSource().forEachFeature((f)=>{
            f.setStyle(visibilityBaseStyle(this.display, color));
            f.get('properties').color = color;
        })
    }

    setDisplay(dis){
        this.display = dis;
        const source = this.mapLayer.getSource();
        source.forEachFeature((f)=>{
            f.setStyle(visibilityBaseStyle(dis, f.get('properties').color));
        })
    }
}

const FeatureInvisibleStyle = new Style({
    stroke: new Stroke({
        color: 'rgba(0,0,0,0)',
        width: 10
    }),
    fill: new Fill({
        color: 'rgba(0,0,0,0)',
    }),
});

function visibilityBaseStyle(display, color, opacity = 0, width=1.25) {
    if (display == variables.ZONES_SHOW_ALL) {
        return createStyle(color, opacity)
    }
    if (display == variables.ZONES_SHOW_NONE || display == variables.ZONES_SHOW_DEFAULT) {
        return FeatureInvisibleStyle
    } else {
        console.warn("Invalid display value: ", display)
        return FeatureInvisibleStyle
    }
}

function visibilityStrongStyle(visibility, color, opacity = 0.1, width=1.75) {
    if (visibility == variables.ZONES_SHOW_ALL) {
        return createStyle(color, opacity, width)
    }
    if (visibility == variables.ZONES_SHOW_DEFAULT){
        return createStyle(color, opacity, width)
    }
    if (visibility == variables.ZONES_SHOW_NONE ) {
        return FeatureInvisibleStyle
    } else {
        console.warn("Invalid display value: ", visibility)
        return FeatureInvisibleStyle
    }
}

function createStyle(color, opacity, width=1) {
    if (typeof color == 'string') {
        color = hex2rgb(color);
    }
    const style = new Style({
        stroke: new Stroke({
            color: 'rgb('+ color[0] +', '+ color[1]+', '+color[2]+')',
            width: width
        }),
        fill: new Fill({
            color: 'rgb('+ color[0] +', '+ color[1]+', '+color[2]+', '+opacity+')',
        }),
    });
    return style
}


export {Layer, visibilityBaseStyle, visibilityStrongStyle, createStyle, FeatureInvisibleStyle};
