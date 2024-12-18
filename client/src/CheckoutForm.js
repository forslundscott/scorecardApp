
import { useState } from "react";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { PaymentElement } from "@stripe/react-stripe-js";
export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!stripe || !elements){
      return
    }
    setIsProcessing(true)
    const {error, paymentIntent} =await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/completion`
      },
      redirect: "if_required"
    })
    if(error){
      setMessage(error.message)
    }
    else if (paymentIntent && paymentIntent.status === 'succeeded'){
      setMessage('Payment status: ' + paymentIntent.status + '')
    }
    setIsProcessing(false)
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" options={{layout: 'tabs',
      appearance: {
        theme: 'night', // Use the predefined "night" theme
        variables: {
          colorText: '#ffffff',
          colorBackground: '#1a1a1a',
          fontFamily: '"Roboto", sans-serif',
        },
      },
      // style: {
      //   base: {
      //     color: "#cccccc",
      //     fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      //     fontSmoothing: "antialiased",
      //     fontSize: "16px",
      //     "::placeholder": {
      //       color: "#cccccc",
      //     },
      //   },
        // invalid: {
        //   color: "#fa755a",
        //   iconColor: "#fa755a",
        // },
      // },

      }} />
      <button disabled={isProcessing} id="submit">
        <span id="button-text">
          {isProcessing ? "Processing ... " : "Pay now"}
        </span>
      </button>
      {/* Show any error or success messages */}
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}