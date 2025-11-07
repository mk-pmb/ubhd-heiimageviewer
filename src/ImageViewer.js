// src/ImageViewer.js
import { DragPan } from 'ol/interaction.js';
import { WheelControl } from './controls.js';
import ImageBase from './ImageBase.js';

/** @class
 *@classdesc Main class for the viewer.
 * */
class ImageViewer extends ImageBase {
  constructor({ ...rest }) {
    super({ ...rest });
  }

  updateInteractions() {
    this.map.addInteraction(new DragPan());
    this.toggleWheel(this.wheelMode);
  }

  createViewer() {
    super.createViewer();
    const mouseWheelControl = new WheelControl(
      { viewer: this, wheelMode: this.wheelMode });
    this.map.addControl(mouseWheelControl);
    this.updateControls(this.lang);
  }
}


const EX = function createViewer(how) {
  // The purpose of exporting a factory instead of a constructor is
  // to grant us more freedom of implementation in future versions.
  const layer = new ImageViewer(how);
  return layer;
};


EX.internals = Object.bind(null, {
  ImageBase,
  ImageViewer,
});


export default EX;
