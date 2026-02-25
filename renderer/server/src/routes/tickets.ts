import { Router } from 'express';
import { getRepository } from 'typeorm';
import { body, param, validationResult } from 'express-validator';
import { Ticket } from '../entities/Ticket';
import { User } from '../entities/User';
import { TicketNote } from '../entities/TicketNote';
import { Activity } from '../entities/Activity';
import { cacheService, wsService, auditService } from '../index';
import { authMiddleware } from '../middleware/auth';
import { generateTicketNumber } from '../utils/ticket';
import { logger } from '../config/logger';

const router = Router();

// Get tickets with filtering and pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignedTo,
      createdBy,
      search,
      fromDate,
      toDate
    } = req.query;

    const ticketRepo = getRepository(Ticket);
    const queryBuilder = ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoinAndSelect('ticket.requester', 'requester')
      .leftJoinAndSelect('ticket.notes', 'notes')
      .orderBy('ticket.createdAt', 'DESC');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('ticket.status IN (:...status)', { status: status.split(',') });
    }

    if (priority) {
      queryBuilder.andWhere('ticket.priority IN (:...priority)', { priority: priority.split(',') });
    }

    if (assignedTo) {
      queryBuilder.andWhere('ticket.assignedToId = :assignedTo', { assignedTo });
    }

    if (createdBy) {
      queryBuilder.andWhere('ticket.createdById = :createdBy', { createdBy });
    }

    if (search) {
      queryBuilder.andWhere(
        '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket.ticketNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (fromDate) {
      queryBuilder.andWhere('ticket.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('ticket.createdAt <= :toDate', { toDate });
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    queryBuilder.skip(skip).take(Number(limit));

    const [tickets, total] = await queryBuilder.getManyAndCount();

    // Cache tickets for quick access
    tickets.forEach(ticket => {
      cacheService.cacheTicket(ticket.id, ticket);
    });

    res.json({
      tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Try cache first
    let ticket = await cacheService.getTicket(id);
    
    if (!ticket) {
      const ticketRepo = getRepository(Ticket);
      ticket = await ticketRepo.findOne({
        where: { id },
        relations: ['assignedTo', 'createdBy', 'requester', 'notes', 'notes.createdBy', 'asset']
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Cache for next time
      await cacheService.cacheTicket(id, ticket);
    }

    // Log activity
    await auditService.log({
      action: 'ticket.viewed',
      entityType: 'ticket',
      entityId: id,
      userId: req.user.id
    });

    res.json(ticket);
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket
router.post('/',
  authMiddleware,
  [
    body('title').notEmpty().trim(),
    body('description').notEmpty(),
    body('priority').isIn(['critical', 'high', 'medium', 'low']),
    body('category').isIn(['hardware', 'software', 'network', 'printer', 'email', 'access', 'other']),
    body('requesterEmail').isEmail().optional(),
    body('assignedToId').optional().isUUID()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const ticketRepo = getRepository(Ticket);
      const userRepo = getRepository(User);

      // Generate ticket number
      const ticketNumber = await generateTicketNumber();

      // Find or create requester
      let requester = null;
      if (req.body.requesterEmail) {
        requester = await userRepo.findOne({ where: { email: req.body.requesterEmail } });
      }

      const ticket = new Ticket();
      ticket.ticketNumber = ticketNumber;
      ticket.title = req.body.title;
      ticket.description = req.body.description;
      ticket.type = req.body.type || 'incident';
      ticket.status = 'new';
      ticket.priority = req.body.priority;
      ticket.category = req.body.category;
      ticket.subcategory = req.body.subcategory;
      ticket.createdById = req.user.id;
      
      if (requester) {
        ticket.requesterId = requester.id;
      } else if (req.body.requesterEmail) {
        ticket.contactInfo = {
          name: req.body.requesterName || req.body.requesterEmail,
          email: req.body.requesterEmail,
          phone: req.body.requesterPhone
        };
      }

      if (req.body.assignedToId) {
        ticket.assignedToId = req.body.assignedToId;
      }

      if (req.body.systemInfo) {
        ticket.systemInfo = req.body.systemInfo;
      }

      if (req.body.assetId) {
        ticket.assetId = req.body.assetId;
      }

      // Add audit trail
      ticket.audit = {
        created: { at: new Date(), by: req.user.id },
        assigned: [],
        status: [],
        notes: { count: 0 }
      };

      const savedTicket = await ticketRepo.save(ticket);

      // Log activity
      await auditService.log({
        action: 'ticket.created',
        entityType: 'ticket',
        entityId: savedTicket.id,
        userId: req.user.id,
        metadata: {
          ticketNumber: savedTicket.ticketNumber,
          priority: savedTicket.priority
        }
      });

      // Broadcast via WebSocket
      wsService.broadcastToTeam(req.user.teamId, 'ticket:created', {
        ticket: savedTicket,
        createdBy: req.user.id
      });

      res.status(201).json(savedTicket);
    } catch (error) {
      logger.error('Error creating ticket:', error);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  }
);

// Update ticket
router.put('/:id',
  authMiddleware,
  [
    param('id').isUUID(),
    body('status').optional().isIn(['new', 'open', 'in-progress', 'pending', 'resolved', 'closed', 'cancelled']),
    body('priority').optional().isIn(['critical', 'high', 'medium', 'low']),
    body('assignedToId').optional().isUUID()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const ticketRepo = getRepository(Ticket);
      
      const ticket = await ticketRepo.findOne({ where: { id } });
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const oldStatus = ticket.status;
      const oldPriority = ticket.priority;
      const oldAssignee = ticket.assignedToId;

      // Track changes for audit
      const changes: any = {};

      // Update fields
      if (req.body.status && req.body.status !== ticket.status) {
        ticket.status = req.body.status;
        changes.status = { from: oldStatus, to: req.body.status };
        
        // Add to audit trail
        ticket.audit.status.push({
          at: new Date(),
          from: oldStatus,
          to: req.body.status,
          by: req.user.id
        });

        // If resolved, set resolvedAt
        if (req.body.status === 'resolved') {
          ticket.resolvedAt = new Date();
        }
      }

      if (req.body.priority && req.body.priority !== ticket.priority) {
        ticket.priority = req.body.priority;
        changes.priority = { from: oldPriority, to: req.body.priority };
      }

      if (req.body.assignedToId && req.body.assignedToId !== ticket.assignedToId) {
        ticket.assignedToId = req.body.assignedToId;
        changes.assignedTo = { from: oldAssignee, to: req.body.assignedToId };
        
        ticket.audit.assigned.push({
          at: new Date(),
          by: req.user.id,
          to: req.body.assignedToId
        });
      }

      if (req.body.title) {
        ticket.title = req.body.title;
        changes.title = { from: ticket.title, to: req.body.title };
      }

      if (req.body.description) {
        ticket.description = req.body.description;
        changes.description = { from: ticket.description, to: req.body.description };
      }

      if (req.body.resolution) {
        ticket.resolution = req.body.resolution;
        changes.resolution = { from: ticket.resolution, to: req.body.resolution };
      }

      if (req.body.timeSpent) {
        ticket.timeSpent = (ticket.timeSpent || 0) + req.body.timeSpent;
      }

      ticket.updatedAt = new Date();

      const updatedTicket = await ticketRepo.save(ticket);

      // Invalidate cache
      await cacheService.invalidateTicket(id);

      // Log activity
      await auditService.log({
        action: 'ticket.updated',
        entityType: 'ticket',
        entityId: id,
        userId: req.user.id,
        changes
      });

      // Broadcast via WebSocket
      wsService.broadcastToTeam(req.user.teamId, 'ticket:updated', {
        ticketId: id,
        changes,
        updatedBy: req.user.id
      });

      // If assigned to someone, notify them
      if (changes.assignedTo) {
        wsService.broadcastToUser(req.body.assignedToId, 'ticket:assigned', {
          ticketId: id,
          ticketNumber: ticket.ticketNumber,
          assignedBy: req.user.id
        });
      }

      res.json(updatedTicket);
    } catch (error) {
      logger.error('Error updating ticket:', error);
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  }
);

// Add note to ticket
router.post('/:id/notes',
  authMiddleware,
  [
    param('id').isUUID(),
    body('content').notEmpty(),
    body('internal').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const ticketRepo = getRepository(Ticket);
      const noteRepo = getRepository(TicketNote);

      const ticket = await ticketRepo.findOne({ where: { id } });
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const note = new TicketNote();
      note.content = req.body.content;
      note.isInternal = req.body.internal || false;
      note.ticketId = id;
      note.createdById = req.user.id;

      const savedNote = await noteRepo.save(note);

      // Update ticket audit
      ticket.audit.notes.count += 1;
      ticket.updatedAt = new Date();
      await ticketRepo.save(ticket);

      // Invalidate cache
      await cacheService.invalidateTicket(id);

      // Log activity
      await auditService.log({
        action: 'ticket.note_added',
        entityType: 'ticket',
        entityId: id,
        userId: req.user.id,
        metadata: {
          noteId: savedNote.id,
          isInternal: savedNote.isInternal
        }
      });

      // Broadcast via WebSocket
      wsService.broadcastToTeam(req.user.teamId, 'ticket:note', {
        ticketId: id,
        note: savedNote,
        addedBy: req.user.id
      });

      res.status(201).json(savedNote);
    } catch (error) {
      logger.error('Error adding note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

// Get ticket metrics
router.get('/metrics/summary', authMiddleware, async (req, res) => {
  try {
    const ticketRepo = getRepository(Ticket);
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const metrics = await ticketRepo
      .createQueryBuilder('ticket')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN ticket.status = \'open\' THEN 1 ELSE 0 END) as open',
        'SUM(CASE WHEN ticket.status = \'in-progress\' THEN 1 ELSE 0 END) as inProgress',
        'SUM(CASE WHEN ticket.status = \'resolved\' THEN 1 ELSE 0 END) as resolved',
        'AVG(CASE WHEN ticket.resolvedAt IS NOT NULL THEN EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt))/3600 ELSE NULL END) as avgResolutionHours',
        'ticket.priority',
        'ticket.category'
      ])
      .where('ticket.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('ticket.priority, ticket.category')
      .getRawMany();

    // Try cache first
    const cached = await cacheService.get('ticket:metrics:daily');
    if (cached) {
      return res.json(cached);
    }

    const dailyTrends = await ticketRepo
      .createQueryBuilder('ticket')
      .select([
        'DATE(ticket.createdAt) as date',
        'COUNT(*) as count'
      ])
      .where('ticket.createdAt >= :start', { start })
      .groupBy('DATE(ticket.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    const result = {
      period: { start, end },
      metrics,
      dailyTrends,
      summary: {
        total: metrics.reduce((acc, m) => acc + parseInt(m.total), 0),
        open: metrics.reduce((acc, m) => acc + parseInt(m.open || '0'), 0),
        inProgress: metrics.reduce((acc, m) => acc + parseInt(m.inProgress || '0'), 0),
        resolved: metrics.reduce((acc, m) => acc + parseInt(m.resolved || '0'), 0),
        avgResolutionHours: metrics[0]?.avgResolutionHours || 0
      }
    };

    // Cache for 1 hour
    await cacheService.set('ticket:metrics:daily', result, 3600);

    res.json(result);
  } catch (error) {
    logger.error('Error fetching ticket metrics:', error);
    res.status(500).json({ error: 'Failed to fetch ticket metrics' });
  }
});

export default router;