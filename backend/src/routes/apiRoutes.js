const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const demoController = require('../controllers/demoController');
const predictionController = require('../controllers/predictionController');
const comparisonController = require('../controllers/comparisonController');

router.post('/requests', requestController.submitRequest);
router.get('/allocations', requestController.getAllocations);
router.get('/inventory', requestController.getInventory);

router.post('/demo/start', demoController.startDemo);
router.post('/demo/stop', demoController.stopDemo);
router.get('/demo/status', demoController.demoStatus);
router.post('/demo/compare', comparisonController.compare);

router.post('/predict', predictionController.predict);

module.exports = router;
