
import './App.css';
import Payment from './Payment'
import Completion from './Completion'
import CatchAll from './CatchAll';
import {BrowserRouter, Routes, Route, useParams} from 'react-router-dom';

function App() {
  const { '*': unmatchedPath } = useParams()
    return (
    <main>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Payment />} />
          <Route path="/completion" element={<Completion />} />
          <Route path="*" element={<CatchAll />} />
        </Routes>
      </BrowserRouter>
    </main>
  );
}

export default App;
