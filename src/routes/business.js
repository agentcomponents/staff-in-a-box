const express = require('express');
const router = express.Router();

// Get business configuration
router.get('/:id', async (req, res) => {
  try {
    const businessId = req.params.id;

    const business = await req.app.locals.dbService.getBusinessConfig(businessId);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(business);
  } catch (error) {
    console.error('Error getting business:', error);
    res.status(500).json({ error: 'Failed to get business' });
  }
});

// Create new business
router.post('/', async (req, res) => {
  try {
    const businessData = req.body;

    const business = await req.app.locals.dbService.createBusiness(businessData);

    res.status(201).json(business);
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// Update business configuration
router.put('/:id', async (req, res) => {
  try {
    const businessId = req.params.id;
    const updates = req.body;

    const business = await req.app.locals.dbService.updateBusiness(businessId, updates);

    res.json(business);
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

// Get business escalations
router.get('/:id/escalations', async (req, res) => {
  try {
    const businessId = req.params.id;
    const { status, limit = 20 } = req.query;

    const escalations = await req.app.locals.dbService.getEscalations(
      businessId,
      status,
      parseInt(limit)
    );

    res.json(escalations);
  } catch (error) {
    console.error('Error getting escalations:', error);
    res.status(500).json({ error: 'Failed to get escalations' });
  }
});

// Get business tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const businessId = req.params.id;
    const { status, limit = 20 } = req.query;

    const tasks = await req.app.locals.dbService.getTasks(
      businessId,
      status,
      parseInt(limit)
    );

    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Get business analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const businessId = req.params.id;
    const { start_date, end_date } = req.query;

    const stats = await req.app.locals.dbService.getConversationStats(
      businessId,
      start_date,
      end_date
    );

    res.json(stats);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

module.exports = router;