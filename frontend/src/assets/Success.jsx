import { useNavigate } from "react-router-dom";
import styles from "./Success.module.css";
import { useEffect, useRef, useState } from "react";

function Success({ name }) {
  const [count, setCount] = useState(4);
  const navigate = useNavigate();
  const intervalRef = useRef(null);
  useEffect(() => {
    if (count === 1) {
      navigate("/login");
    }
    intervalRef.current = setInterval(() => {
      setCount((prevCount) => {
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
  }, [count]);
  return (
    <div className={styles.successcont}>
      <h1>
        Success! Congratulations🎉 <br /> {name}
      </h1>
      <p>Your details have been submitted successfully.</p>
      <p>
        For the next step, you are required to confirm your{" "}
        <b style={{ color: " rgb(209, 79, 79)" }}>Airtel details</b>{" "}
      </p>
      <span>Redirecting to Airtel... {count}</span>
    </div>
  );
}

export default Success;
