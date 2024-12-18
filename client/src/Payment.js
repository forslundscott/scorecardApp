import {useEffect, useState} from 'react';

import {loadStripe} from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm'
import { Elements } from '@stripe/react-stripe-js';

function Payment(props) {
  const [stripePromise, setStripePromise] = useState(null)
  const [clientSecret, setClientSecret] = useState("")
  useEffect(() => {
    fetch("/api/payments/config").then(async (r) => {
      const {publishableKey} = await r.json();

      setStripePromise(loadStripe(publishableKey));
    })
  }, [])
  useEffect(() => {
    fetch("/api/payments/create-payment-intent", {
      method: "POST",
      body: JSON.stringify({})
    }).then(async (r) => {
      const {clientSecret} = await r.json();

      setClientSecret(clientSecret);
    })
  }, [])

  return (
    <>
      <h1>Payment</h1>
      {stripePromise && clientSecret &&(
        <Elements stripe={stripePromise} options={{clientSecret,appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#ceff00'
          }
        }}}>
          <CheckoutForm/>
        </Elements>
      )}
      
      
    </>
  );
}

export default Payment;