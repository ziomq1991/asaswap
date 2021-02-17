export default function() {
  return {
    serviceInstance: null,
    connected: false,
    accounts: [],
    fetchedAccounts: false,
    account: localStorage.getItem('account'),
    accountData: null,
    applicationData: null,
    pendingUpdate: false,
    pendingAction: null,
    pendingActionMessage: null
  };
}
