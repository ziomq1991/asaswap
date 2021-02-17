import eventBus from '@/utils/eventBus';

export function emitError(message) {
  eventBus.$emit('open-alert', {
    type: 'error',
    message: message
  });
}
