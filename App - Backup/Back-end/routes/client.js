const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.post('/', clientController.createClient);
router.get('/:uid', clientController.listClients);
router.delete('/:uid/:clientId', clientController.deleteClient);
router.put('/:uid/:clientId', clientController.updateClient);

module.exports = router;
