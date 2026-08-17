import './functions/http';
import { mockStore } from './lib/mockStore';
import { isMockMode } from './lib/types';

if (isMockMode()) {
  mockStore.init();
}
