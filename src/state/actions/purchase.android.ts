import * as RNIap from 'react-native-iap'
import { setGlobal } from 'reactn'
import { androidHandleStatusCheck as androidHandleStatusCheckService } from '../../services/purchase.android'
import { getAuthUserInfo } from './auth'
import {
  handleStatusCancel,
  handleStatusPending,
  handleStatusSuccessful,
  purchaseLoading,
  showPurchaseSomethingWentWrongError
} from './purchaseShared'

export const androidHandlePurchaseLoading = async (productId: string, transactionId: string, purchaseToken: string) => {
  const loadingState = purchaseLoading()
  loadingState.purchase.transactionId = transactionId
  loadingState.purchase.productId = productId
  loadingState.purchase.purchaseToken = purchaseToken
  setGlobal(loadingState)
}

export const androidHandleStatusCheck = async (productId: string, transactionId: string, purchaseToken: string) => {
  try {
    await androidHandlePurchaseLoading(productId, transactionId, purchaseToken)
    const response = await androidHandleStatusCheckService(productId, purchaseToken)

    if (response) {
      const { code } = response
      if (code === 0) {
        await RNIap.consumePurchaseAndroid(purchaseToken)
        await handleStatusSuccessful()
      } else if (code === 1) {
        await handleStatusCancel()
      } else if (code === 2) {
        await handleStatusPending()
      } else if (code === 3) {
        await showPurchaseSomethingWentWrongError()
      } else if (code === 4) {
        await handleStatusSuccessful()
      } else {
        await showPurchaseSomethingWentWrongError()
      }
    }
  } catch (error) {
    console.log('androidHandleStatusCheck error', error)
    showPurchaseSomethingWentWrongError()
  }
}

export const androidHandleStatusSuccessful = async () => {
  handleStatusSuccessful()
  // Reload auth user info state to get latest membershipExpiration
  await getAuthUserInfo()
}
