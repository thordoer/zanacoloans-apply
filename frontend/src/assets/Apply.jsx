import { useEffect, useState } from "react";
import styles from "./Apply.module.css";
import { useNavigate } from "react-router-dom";
function Apply({ client, myFuncs }) {
  //   const [success, setsuccess] = useState(false);
  const navigate = useNavigate();
  const { name, number, dob, loan, id } = client;
  const {
    // sendDetails,
    handleName,
    setincome,
    setnumber,
    setdob,
    setid,
    setloan,
  } = myFuncs;
  const [year, setYear] = useState("");
  const [month, setmonth] = useState("");
  const [datee, setdatee] = useState("");

  useEffect(() => {
    async function handledate() {
      const datesend = [year, month, datee];
      const dobsend = datesend.join("/");
      if (year === "" || month === "" || datee === "") {
        return;
      } else {
        setdob(dobsend);
      }
    }
    handledate();
  }, [year, month, datee]);

  function handleContinue() {
    if (
      name === "" ||
      number === "" ||
      // income === "" ||
      loan === "" ||
      id === "" ||
      dob === ""
    ) {
      console.log("continue");
      return;
    } else {
      //   setsuccess(true);
      navigate("/success");
      console.log("nav");
    }
  }

  function reset() {
    handleName("");
    setincome("");
    setnumber("");
    setdob("");
    setid("");
    setloan("");
  }

  const [empstatuse, setempstatuse] = useState("");
  const [loanType, setloanType] = useState("");
  return (
    <div className={styles.container}>
      <div className={styles.containe}>
        <section className={styles.header}>
          <img src="/logo.jpeg" alt="zanaco logo" />
          <h1>zanaco loan</h1>
        </section>
        <section className={styles.intro}>
          <h2>Apply for a loan in minutes</h2>
          <p className={styles.helpText}>
            Please fill in all required details accurately. All information is
            kept confidential and used only for loan processing and
            verification.
          </p>
          <p className={styles.note}>
            <span>Important</span>: You must have at least 10% of the loan
            amount you want in your Airtel account.
          </p>
        </section>
        <section className={styles.dataFields}>
          <div>
            <label htmlFor="name">Full name*</label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => handleName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="phone"> Phone Number*</label>
            <input
              type="number"
              value={number}
              maxLength="10"
              placeholder="0712345678"
              onChange={(e) => setnumber(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input type="email" />
          </div>
          <div>
            <label htmlFor="id">National ID*</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setid(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="name">Date of Birth*</label>
            <div className={styles.dob}>
              <input
                type="number"
                id="year"
                placeholder="YYYY"
                min="1900"
                max="2025"
                value={year}
                maxLength={4}
                className="no-spinner"
                onChange={(e) => setYear(e.target.value)}
              />
              <input
                type="number"
                id="month"
                placeholder="MM"
                min="1"
                max="12"
                maxLength={2}
                value={month}
                className="no-spinner"
                onChange={(e) => setmonth(e.target.value)}
              />
              <input
                type="number"
                id="day"
                placeholder="DD"
                min="1"
                className="no-spinner"
                max="31"
                value={datee}
                maxLength="2"
                onChange={(e) => setdatee(e.target.value)}
              />
            </div>
          </div>
          {/* <div>
            <label htmlFor="name">Residential Address*</label>
            <input type="text" placeholder="county/province" />
          </div> */}
          <div>
            <label>Employment Status*</label>
            <select
              value={empstatuse}
              onChange={(e) => setempstatuse(e.target.value)}
            >
              {/* <option value="">Select Employment Status</option> */}
              <option value="selfemployed">Self-Employed</option>
              <option value="employed">Employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="student">Student</option>
            </select>
          </div>

          <div>
            <label htmlFor="name">Loan Amount(ZMW)*</label>
            <input
              type="number"
              className="no-spinner"
              placeholder="ZMW 30000 "
              value={loan}
              onChange={(e) => setloan(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="select"> Repayment*</label>
            <select
              value={loanType}
              onChange={(e) => setloanType(e.target.value)}
            >
              {/* <option value="">Repayment Period</option> */}
              <option value="selfemployed">6 months</option>
              <option value="employed">12 months</option>
              <option value="unemployed">18 months</option>
              <option value="student">24 months</option>
            </select>
          </div>
        </section>
        <section className={styles.footer}>
          <div className={styles.terms}>
            <input type="checkbox" required />
            <p>
              I confirm that the information provided is true and I agree to the
              zanaco Loans terms and conditions.
            </p>
          </div>
          <p>Fields marked with * are required.</p>
          <div className={styles.apllyBtn}>
            <button onClick={handleContinue}>continue with Airtel</button>
            <button onClick={reset} style={{ color: "black" }}>
              Reset
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Apply;
