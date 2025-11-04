import { intersects } from 'ol/extent.js';
import { OverviewMap } from 'ol/control.js';
import { View } from 'ol';

import { fade } from './fade.js';
import i18n from './transl.js';


function getElemByCls(viewer, cls) {
  return viewer.container.getElementsByClassName(cls)[0];
}


const EX = {
  // Exporting an object rather tha just the function because we'll probably
  // need to merge fade.js into this soon.

  installIntoViewer(viewer) {
    const overviewResolution = Math.max(
      Math.abs(viewer.extent[1]),
      Math.abs(viewer.extent[2]),
    ) / viewer.overviewMapSize;
    const overviewMapControl = new OverviewMap({
      className: 'ol-overviewmap ol-custom-overviewmap',
      layers: [viewer.overviewLayer],
      label: i18n.buttonIconAndLabel('overviewMapHidden', 'span'),
      collapseLabel: i18n.buttonIconAndLabel('overviewMapVisible', 'span'),
      tipLabel: i18n('overviewMapVisible'),
      collapsed: viewer.overviewMapCollapsed,
      view: new View({
        projection: viewer.projection,
        resolutions: [overviewResolution],
        extent: viewer.extent,
        constrainResolution: true,
      }),
    });

    // We first need to add the control in order to then access its DOM:
    viewer.map.addControl(overviewMapControl);
    const overvmap = getElemByCls(viewer, 'ol-custom-overviewmap');
    const overviewCanvas = overvmap.querySelector('.ol-overviewmap-map');
    const zoomslider = getElemByCls(viewer, 'ol-zoomslider');

    let overviewMapTimer;
    let prevPos;
    let zoomslideTimer;

    function overviewPreserve() {
      clearTimeout(overviewMapTimer);
      clearTimeout(zoomslideTimer);
      overviewCanvas.style.visibility = 'visible';
      overviewCanvas.style.opacity = 1;
      overviewCanvas.parentElement.style.borderBottom = '1px solid black';
      overviewCanvas.parentElement.style.borderRight = '1px solid black';
      zoomslider.style.opacity = 1;
      zoomslider.style.display = 'block';
      zoomslider.style.visibility = 'visible';
    }

    viewer.map.on('movestart', () => {
      prevPos = viewer.map.getView().getCenter();
      if (overviewMapControl.getCollapsed()) { return; }
      overviewPreserve();
    });

    viewer.map.on('moveend', () => {
      const view = viewer.map.getView();
      const mapviewport = view.calculateExtent(viewer.map.getSize());
      if (!intersects(mapviewport, viewer.extent)) {
        view.setCenter(prevPos);
      }
      /* Overview map reset timer */
      if (overviewMapControl.getCollapsed()) { return; }
      overviewMapTimer = setTimeout(fade, 2500, overviewCanvas);
      zoomslideTimer = setTimeout(fade, 2500, zoomslider);
    });

    const overviewButton = overvmap.querySelector('button');
    overviewButton.onclick = function overviewButtonClicked() {
      const isCurrentlyCollapsed = overviewMapControl.getCollapsed();
      if (isCurrentlyCollapsed) {
        overviewCanvas.style.visibility = 'hidden';
        zoomslider.style.visibility = 'hidden';
      } else {
        overviewPreserve();
      }
    };

    zoomslider.addEventListener('mouseover', () => {
      overviewPreserve();
    });
    zoomslider.addEventListener('mouseleave', () => {
      overviewPreserve();
      overviewMapTimer = setTimeout(fade, 2500, overviewCanvas);
      zoomslideTimer = setTimeout(fade, 2500, zoomslider);
    });

    overviewMapControl.getOverviewMap().on('pointerdrag', overviewPreserve);
    overviewMapControl.getOverviewMap().on('click', overviewPreserve);

    // eslint-disable-next-line no-param-reassign
    viewer.overviewMapControl = overviewMapControl;
  },


};



export default EX;
