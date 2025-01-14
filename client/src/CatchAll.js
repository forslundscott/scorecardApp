import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const CatchAll = () => {
  const navigate = useNavigate();
  const { "*": path } = useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRedirect = async () => {
      try {
        console.log(path)
        const response = await fetch(`/${path}`);
        const data = await response.json();
        // window.location.href = '/teams'
        // if (data.route) {
        //   await navigate(data.route); // Redirect to the route from the backend
        // }
      } catch (error) {
        console.error('Error fetching redirect:', error);
        // Handle error or navigate to a default route
      } finally {
        setLoading(false);
      }
    };

    fetchRedirect();
  }, [navigate]);

  return loading ? <p>Loading...</p> : null;
};

export default CatchAll;
