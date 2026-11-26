// The carequeue theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in carequeue.settings.json and the generated carequeue.settings.ts;
// change them with `astryx experimental theme editor set carequeue ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {carequeueSettings} from './carequeue.settings';

export const carequeueTheme = defineTheme({
  extends: carequeueSettings,
  name: 'carequeue',
});
