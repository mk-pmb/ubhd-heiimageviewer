import { Fill, Stroke, Style } from 'ol/style.js';
import parseCssColorString from 'parse-color';

import variables from './variables.js';


const EX = {

  create(color, opacity, width = 1) {
    const rgb = (Array.isArray(color) ? color : parseCssColorString(color).rgb
    ).slice(0, 3).join(',');
    const style = new Style({
      stroke: new Stroke({ color: 'rgb(' + rgb + ')', width }),
      fill: new Fill({ color: 'rgba(' + rgb + ',' + opacity + ')' }),
    });
    return style;
  },


  invisibleFeature: new Style({
    stroke: new Stroke({
      color: 'rgba(0,0,0,0)',
      width: 10,
    }),
    fill: new Fill({
      color: 'rgba(0,0,0,0)',
    }),
  }),


  visibilityBaseStyle(display, color, opacity = 0, width = 1.25) {
    if (display === variables.ZONES_SHOW_ALL) {
      return EX.create(color, opacity, width);
    }
    if (display === variables.ZONES_SHOW_DEFAULT) {
      return EX.invisibleFeature;
    }
    if (display === variables.ZONES_SHOW_NONE) {
      return EX.invisibleFeature;
    }
    console.warn('Invalid display value: ', display);
    return EX.invisibleFeature;
  },


  visibilityStrongStyle(visibility, color, opacity = 0.1, width = 1.75) {
    if (visibility === variables.ZONES_SHOW_ALL) {
      return EX.create(color, opacity, width);
    }
    if (visibility === variables.ZONES_SHOW_DEFAULT) {
      return EX.create(color, opacity, width);
    }
    if (visibility === variables.ZONES_SHOW_NONE) {
      return EX.invisibleFeature;
    }
    console.warn('Invalid display value: ', visibility);
    return EX.invisibleFeature;
  },


};





export default EX;
