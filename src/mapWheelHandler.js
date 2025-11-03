import { containsCoordinate } from 'ol/extent.js';
import { MouseWheelZoom } from 'ol/interaction.js';

import variables from './variables.js';


const EX = function makeMapWheelHandler(viewer) {
  const { map } = viewer;
  const hnd = new MouseWheelZoom({
    condition(e) {
      if (e.type !== 'wheel') { return; }
      if (viewer.wheelMode === variables.MW_VERTICAL) {
        e.originalEvent.preventDefault();
        const view = map.getView();
        const center = view.getCenter();
        const variation = 50;
        if (e.originalEvent.deltaY < 0) {
          view.setCenter([center[0], center[1] + variation]);
        }
        if (e.originalEvent.deltaY > 0) {
          view.setCenter([center[0], center[1] - variation]);
        }
        /* :TODO: Hier stand ungültig "prevPos = null;", aber funktionierte
          eh nicht: "prevPos was used before it was defined."
          Was war gemeint? Müssen wir den viwer benachrichtigen?
          Dort kommt prevPos nämlich tief vergraben in createViewer vor. */
        return false;
      }
      const coord = map.getCoordinateFromPixel(e.pixel);
      return !!containsCoordinate(viewer.extent, coord);
    },
  });
  return hnd;
};


export default EX;
