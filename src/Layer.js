import layerStyles from './layerStyles.js';
import variables from './variables.js';

const { visibilityBaseStyle } = layerStyles;


const debug = {
  layersByName: new Map(),
  mapLayer: false,
};


class Layer {
  constructor(options) {
    this.name = options.name;
    this.type = options.type;
    this.color = options.color || variables.COLOR_DEFAULT;
    this.features = options.features || [];
    this.display = options.display || 'default';
    this.baseOpacity = options.baseOpacity || 0;
    this.hoverOpacity = options.hoverOpacity || 0.1;
    debug.layersByName.set(this.name, this);
  }

  setMapLayer(l) {
    this.mapLayer = l;
    debug.mapLayer = l;
  }

  getMapLayer() {
    return this.mapLayer;
  }

  getName() {
    return this.name;
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

  setColor(color) {
    const layer = this;
    layer.color = color;
    const { mapLayer } = layer;
    mapLayer.getSource().forEachFeature(function updateFeatureColor(feat) {
      feat.setStyle(visibilityBaseStyle(layer.display, color));
      // eslint-disable-next-line no-param-reassign
      feat.get('properties').color = color;
    });
  }

  setDisplay(dis) {
    const layer = this;
    layer.display = dis;
    const source = layer.mapLayer.getSource();
    source.forEachFeature(function updateFeatureVisibility(feat) {
      feat.setStyle(visibilityBaseStyle(dis, feat.get('properties').color));
    });
  }
}



const EX = function createLayer(how) {
  // The purpose of exporting a factory instead of a constructor is
  // to grant us more freedom of implementation in future versions.
  const layer = new Layer(how);
  return layer;
};


EX.debug = Object.bind(null, debug);
EX.internals = Object.bind(null, {
  Layer,
});


export default EX;
