import { OverviewMap } from 'ol/control.js';
import { WheelControl } from './controls.js';

const EX = function refactorInstanceof(c) {
  return (c instanceof WheelControl) || (c instanceof OverviewMap);
};

export default EX;
