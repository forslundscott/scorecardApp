
import './App.css';
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
    <>
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
    <form id="venmo-form" onSubmit={handleSubmit}>
      <button id="venmo-button">
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAxIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMTAxIDMyIiB4bWxucz0iaHR0cDomI3gyRjsmI3gyRjt3d3cudzMub3JnJiN4MkY7MjAwMCYjeDJGO3N2ZyIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pbllNaW4gbWVldCI+PGcgaWQ9IlBhZ2UtMSIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PGcgaWQ9IkJsdWUiIGZpbGw9IiNmZmZmZmYiPjxnIGlkPSJMb2dvIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwgNi4wMDAwMDApIj48cGF0aCBkPSJNMTYuNjY2MDQ4NCwwLjE4IEMxNy4zNDY2NjI2LDEuMzM5MDk5MSAxNy42NTM1MDY5LDIuNTMyOTcyOTcgMTcuNjUzNTA2OSw0LjA0MTA4MTA4IEMxNy42NTM1MDY5LDguODUxMTcxMTcgMTMuNjcxMzQ2LDE1LjA5OTgxOTggMTAuNDM5MzQ2LDE5LjQ4NzU2NzYgTDMuMDU3MjU5NTIsMTkuNDg3NTY3NiBMMC4wOTY2MzE0ODc5LDEuMjMzMTUzMTUgTDYuNTYwNDU2NzUsMC42MDAzNjAzNiBMOC4xMjU3ODIwMSwxMy41ODk1NDk1IEM5LjU4ODM1OTg2LDExLjEzMjYxMjYgMTEuMzkzMjU0Myw3LjI3MTUzMTUzIDExLjM5MzI1NDMsNC42MzkwOTkxIEMxMS4zOTMyNTQzLDMuMTk4MTk4MiAxMS4xNTM4NTk5LDIuMjE2NzU2NzYgMTAuNzc5NzQwNSwxLjQwODY0ODY1IEwxNi42NjYwNDg0LDAuMTggWiBNMjQuOTA3MTU5MiwxMS42OTM4NzM5IEMyNC45MDcxNTkyLDEzLjgzNjc1NjggMjYuMDYyNzE4LDE0LjY3NzQ3NzUgMjcuNTk0NjY3OCwxNC42Nzc0Nzc1IEMyOS4yNjI5MTUyLDE0LjY3NzQ3NzUgMzAuODYwMjE4LDE0LjI1NzExNzEgMzIuOTM2MzA5NywxMy4xNjkxODkyIEwzMi4xNTQzNDYsMTguNjQ0NTA0NSBDMzAuNjkxNTkzNCwxOS4zODE0NDE0IDI4LjQxMTkyOTEsMTkuODczMTUzMiAyNi4xOTkxOTAzLDE5Ljg3MzE1MzIgQzIwLjU4NjM1MTIsMTkuODczMTUzMiAxOC41Nzc1MzQ2LDE2LjM2MzI0MzIgMTguNTc3NTM0NiwxMS45NzUzMTUzIEMxOC41Nzc1MzQ2LDYuMjg4MTA4MTEgMjEuODQ1MTgxNywwLjI0OTM2OTM2OSAyOC41ODE5NTE2LDAuMjQ5MzY5MzY5IEMzMi4yOTA5OTMxLDAuMjQ5MzY5MzY5IDM0LjM2NDk4NzksMi4zOTIwNzIwNyAzNC4zNjQ5ODc5LDUuMzc1Njc1NjggQzM0LjM2NTMzNzQsMTAuMTg1NTg1NiAyOC4zNzgzNzg5LDExLjY1OTA5OTEgMjQuOTA3MTU5MiwxMS42OTM4NzM5IFogTTI1LjA0MzQ1NjcsOC4yMTgxOTgyIEMyNi4yMzI5MTUyLDguMjE4MTk4MiAyOS4yMjc0NDI5LDcuNjU3MTE3MTIgMjkuMjI3NDQyOSw1LjkwMjE2MjE2IEMyOS4yMjc0NDI5LDUuMDU5NDU5NDYgMjguNjQ5NTc2MSw0LjYzOTA5OTEgMjcuOTY4NjEyNSw0LjYzOTA5OTEgQzI2Ljc3NzIzMTgsNC42MzkwOTkxIDI1LjIxMzgyODcsNi4xMTIyNTIyNSAyNS4wNDM0NTY3LDguMjE4MTk4MiBaIE01My4wMTg3MDkzLDQuNDYzNjAzNiBDNTMuMDE4NzA5Myw1LjE2NTU4NTU5IDUyLjkxNTQzNzcsNi4xODM3ODM3OCA1Mi44MTI2OTAzLDYuODQ5MTg5MTkgTDUwLjg3MzA3MDksMTkuNDg3Mzg3NCBMNDQuNTc5MDkzNCwxOS40ODczODc0IEw0Ni4zNDgzNDA4LDcuOTAyMTYyMTYgQzQ2LjM4MTg5MSw3LjU4NzkyNzkzIDQ2LjQ4NDk4NzksNi45NTUzMTUzMiA0Ni40ODQ5ODc5LDYuNjA0MzI0MzIgQzQ2LjQ4NDk4NzksNS43NjE2MjE2MiA0NS45NzQzOTYyLDUuNTUxMzUxMzUgNDUuMzYwNTMyOSw1LjU1MTM1MTM1IEM0NC41NDUxOTM4LDUuNTUxMzUxMzUgNDMuNzI3OTMyNSw1LjkzNzExNzEyIDQzLjE4MzYxNTksNi4yMTg3Mzg3NCBMNDEuMTc2ODk2MiwxOS40ODc1Njc2IEwzNC44NDc0NDY0LDE5LjQ4NzU2NzYgTDM3LjczOTA1MTksMC41NjU5NDU5NDYgTDQzLjIxNzE2NjEsMC41NjU5NDU5NDYgTDQzLjI4NjUzODEsMi4wNzYyMTYyMiBDNDQuNTc4OTE4NywxLjE5ODczODc0IDQ2LjI4MDcxNjMsMC4yNDk3Mjk3MyA0OC42OTUyODAzLDAuMjQ5NzI5NzMgQzUxLjg5NDI1NDMsMC4yNDkzNjkzNjkgNTMuMDE4NzA5MywxLjkzNDk1NDk1IDUzLjAxODcwOTMsNC40NjM2MDM2IFogTTcxLjcwMzcwOTMsMi4zMjA3MjA3MiBDNzMuNTA2MzMyMiwwLjk4ODEwODEwOCA3NS4yMDg0NzkyLDAuMjQ5MzY5MzY5IDc3LjU1NTQxODcsMC4yNDkzNjkzNjkgQzgwLjc4NzI0MzksMC4yNDkzNjkzNjkgODEuOTExMzQ5NSwxLjkzNDk1NDk1IDgxLjkxMTM0OTUsNC40NjM2MDM2IEM4MS45MTEzNDk1LDUuMTY1NTg1NTkgODEuODA4NDI3Myw2LjE4Mzc4Mzc4IDgxLjcwNTY3OTksNi44NDkxODkxOSBMNzkuNzY4MzMyMiwxOS40ODczODc0IEw3My40NzI2MDczLDE5LjQ4NzM4NzQgTDc1LjI3NTU3OTYsNy42NTcyOTczIEM3NS4zMDg3ODAzLDcuMzQxMDgxMDggNzUuMzc4NTAxNyw2Ljk1NTMxNTMyIDc1LjM3ODUwMTcsNi43MTA2MzA2MyBDNzUuMzc4NTAxNyw1Ljc2MTgwMTggNzQuODY3NzM1Myw1LjU1MTM1MTM1IDc0LjI1NDA0NjcsNS41NTEzNTEzNSBDNzMuNDcyMjU3OCw1LjU1MTM1MTM1IDcyLjY5MDgxODMsNS45MDIzNDIzNCA3Mi4xMTA2Nzk5LDYuMjE4NzM4NzQgTDcwLjEwNDMwOTcsMTkuNDg3NTY3NiBMNjMuODEwMTU3NCwxOS40ODc1Njc2IEw2NS42MTMxMjk4LDcuNjU3NDc3NDggQzY1LjY0NjMzMDQsNy4zNDEyNjEyNiA2NS43MTM5NTUsNi45NTU0OTU1IDY1LjcxMzk1NSw2LjcxMDgxMDgxIEM2NS43MTM5NTUsNS43NjE5ODE5OCA2NS4yMDMwMTM4LDUuNTUxNTMxNTMgNjQuNTkxNDIyMSw1LjU1MTUzMTUzIEM2My43NzQzMzU2LDUuNTUxNTMxNTMgNjIuOTU4ODIxOCw1LjkzNzI5NzMgNjIuNDE0NTA1Miw2LjIxODkxODkyIEw2MC40MDYyMTI4LDE5LjQ4Nzc0NzcgTDU0LjA3ODg1OTksMTkuNDg3NzQ3NyBMNTYuOTcwMTE1OSwwLjU2NjEyNjEyNiBMNjIuMzgxMzA0NSwwLjU2NjEyNjEyNiBMNjIuNTUxMzI3LDIuMTQ1NzY1NzcgQzYzLjgxMDE1NzQsMS4xOTkwOTkxIDY1LjUxMDU1NzEsMC4yNTAwOTAwOSA2Ny43OTAwNDY3LDAuMjUwMDkwMDkgQzY5Ljc2Mzc0MDUsMC4yNDkzNjkzNjkgNzEuMDU1OTQ2NCwxLjEyNzAyNzAzIDcxLjcwMzcwOTMsMi4zMjA3MjA3MiBaIE04My41NTA1OSwxMS43OTk4MTk4IEM4My41NTA1OSw1LjgzMjc5Mjc5IDg2LjYxMjA0MzMsMC4yNDkzNjkzNjkgOTMuNjU1ODMyMiwwLjI0OTM2OTM2OSBDOTguOTYzMzk5NywwLjI0OTM2OTM2OSAxMDAuOTAzNTQzLDMuNDc5ODE5ODIgMTAwLjkwMzU0Myw3LjkzODczODc0IEMxMDAuOTAzNTQzLDEzLjgzNjU3NjYgOTcuODc1MTE1OSwxOS45NDQzMjQzIDkwLjY2MTQ3OTIsMTkuOTQ0MzI0MyBDODUuMzE5NjYyNiwxOS45NDQzMjQzIDgzLjU1MDU5LDE2LjMyODEwODEgODMuNTUwNTksMTEuNzk5ODE5OCBaIE05NC40Mzc0NDY0LDcuODMyNzkyNzkgQzk0LjQzNzQ0NjQsNi4yODgxMDgxMSA5NC4wNjI4MDI4LDUuMjM0OTU0OTUgOTIuOTQwOTY4OSw1LjIzNDk1NDk1IEM5MC40NTcwMzI5LDUuMjM0OTU0OTUgODkuOTQ2OTY1NCw5Ljc2MzA2MzA2IDg5Ljk0Njk2NTQsMTIuMDc5NDU5NSBDODkuOTQ2OTY1NCwxMy44MzY3NTY4IDkwLjQyMzgzMjIsMTQuOTI0MzI0MyA5MS41NDUzMTY2LDE0LjkyNDMyNDMgQzkzLjg5MzEyOTgsMTQuOTI0MzI0MyA5NC40Mzc0NDY0LDEwLjE0OTAwOSA5NC40Mzc0NDY0LDcuODMyNzkyNzkgWiI+PC9wYXRoPjwvZz48L2c+PC9nPjwvc3ZnPg" alt="" class="paypal-logo paypal-logo-venmo paypal-logo-color-white" />
      </button>
    </form>
    </>
  );
}