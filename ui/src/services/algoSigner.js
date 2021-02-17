import { emitError } from '@/utils/errors';
import eventBus from '@/utils/eventBus';

export class AlgoSigner {
  constructor(signer) {
    this.signer = signer;
  }

  async blockingCall(func, retry = true) {
    // Ugly but works
    while (this.promise) {
      await this.promise;
    }
    try {
      this.promise = func();
      try {
        return await this.promise;
      } catch (e) {
        if (e.message === 'Another query processing' && retry) {
          return new Promise(resolve => {
            window.setTimeout(
              async () => {
                resolve(await this.blockingCall(func, false));
              }, 500
            );
          });
        } else {
          throw e;
        }
      }
    } finally {
      this.promise = null;
    }
  }

  async connect() {
    try {
      return await this.signer.connect();
    } catch (e) {
      emitError('Could not connect to AlgoSigner');
      throw e;
    }
  }

  async sign(tx) {
    try {
      return await this.blockingCall(() => this.signer.sign(tx));
    } catch (e) {
      emitError('Transaction could not be signed');
      throw e;
    }
  }

  async accounts(params) {
    try {
      return await this.blockingCall(() => this.signer.accounts(params));
    } catch (e) {
      emitError('Could not fetch information about accounts');
      throw e;
    }
  }

  async algod(params) {
    try {
      return await this.blockingCall(() => this.signer.algod(params));
    } catch (e) {
      emitError('Could not fetch information from the Algorand blockchain');
      throw e;
    }
  }

  async send(params, showSucess = true) {
    try {
      eventBus.$emit('set-action-message', 'Sending...');
      const tx = await this.blockingCall(() => this.signer.send(params));
      if (showSucess) {
        eventBus.$emit('transaction-success', tx.txId);
      }
      return tx;
    } catch (e) {
      const insufficientFundsError = /TransactionPool\.Remember: transaction [A-Z0-9]+: underflow on subtracting \d+ from sender amount \d+/g;
      if (e.message.match(insufficientFundsError)) {
        emitError('Insufficient funds');
        throw e;
      }
      emitError('Unexpected error occured while sending transaction');
      throw e;
    }
  }
}
