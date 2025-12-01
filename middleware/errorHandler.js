const errorHandler = (err, req, res, next) => {
    
    const now = Date.now(); // single point in time
    const timestamp = new Date(now).toISOString();
    const errorId = now.toString(36); // same exact time used

    console.error(`[${timestamp}] Error ID: ${errorId}`, err);
    res.status(500).render('serverError.ejs', { errorId });
};

module.exports = errorHandler;
