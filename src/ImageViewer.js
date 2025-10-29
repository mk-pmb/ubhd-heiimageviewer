// src/ImageViewer.js
import { DragPan } from 'ol/interaction';
import { ImageBase } from './ImageBase.js';
import { WheelControl } from './controls.js';

/** @class
 *@classdesc Main class for the viewer.
 * */
class imageViewer extends ImageBase {
  constructor({ ...rest }) {
    super({ ...rest });
  }

  updateInteractions() {
    this.map.addInteraction(new DragPan());
    this.toggleWheel(this.wheelMode);
  }

  createViewer() {
    super.createViewer();
    const mouseWheelControl = new WheelControl({ viewer: this, wheelMode: this.wheelMode });
    this.map.addControl(mouseWheelControl);
    this.updateControls(this.lang);
  }
}


export { imageViewer };
