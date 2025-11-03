import layerStyles from './layerStyles.js';
import variables from './variables.js';

const { visibilityBaseStyle } = layerStyles;


class Layer {
  constructor(options) {
    this.name = options.name;
    this.type = options.type;
    this.color = options.color ? options.color : variables.COLOR_DEFAULT;
    this.features = options.features ? options.features : [];
    this.display = options.display ? options.display : 'default';
    this.baseOpacity = options.baseOpacity ? options.baseOpacity : 0;
    this.hoverOpacity = options.hoverOpacity ? options.hoverOpacity : 0.1;
  }

  setMapLayer(l) {
    this.mapLayer = l;
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
    this.color = color;
    const { mapLayer } = this;
    mapLayer.getSource().forEachFeature((f) => {
      f.setStyle(visibilityBaseStyle(this.display, color));
      f.get('properties').color = color;
    });
  }

  setDisplay(dis) {
    this.display = dis;
    const source = this.mapLayer.getSource();
    source.forEachFeature((f) => {
      f.setStyle(visibilityBaseStyle(dis, f.get('properties').color));
    });
  }
}


export { Layer };
