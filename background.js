chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({summaryCount: 0, subscribed: false});
  });

chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({subCount: 0, subscribed: false});
  });
  

function handlePaymentVerification(paymentResponse) {
  if (paymentResponse === 'Payment successful. Access granted.') {
    chrome.storage.local.set({ premiumAccess: true }, () => {
      console.log('Premium access granted.');
    });
  } else {
    console.error('Payment verification failed or access not granted.');
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verifyPayment') {
    fetch('https://localhost:3000/', { //dummy end point
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.paymentDetails),
    })
      .then(response => response.text())
      .then(data => {
        // Handle payment verification response
        handlePaymentVerification(data);
        sendResponse({ success: true }); // Send response back to popup.js or content script
      })
      .catch(error => {
        console.error('Error verifying payment:', error);
        sendResponse({ error: 'Error verifying payment' });
      });
    return true; // Indicates async response handling
  }
});
