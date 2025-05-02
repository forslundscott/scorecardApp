const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

  // Optionally generate a reference ID for debugging
  const errorId = Date.now().toString(36); // Or use a UUID

  // You could log the error and errorId together
  console.error(`Error ID: ${errorId}`, err);
    res.status(500).render('serverError.ejs', { errorId });
};

module.exports = errorHandler;
