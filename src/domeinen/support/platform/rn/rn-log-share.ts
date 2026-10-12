import { Share } from 'react-native';
import type { LogShare } from '../../service/log-share';

export function createRnLogShare(): LogShare {
  return {
    async share(text) {
      await Share.share({ message: text });
    },
  };
}
