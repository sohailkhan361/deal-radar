type DealEventType = 'stage_changed' | 'email_sent' | 'meeting_booked' | 'note_added';

type DealEvent = {
  event_id: string;
  deal_id: string;
  event_type: DealEventType;
  occurred_at: string;
  payload: Record<string, unknown>;
};

type Scenario = {
  label: string;
  build: () => DealEvent;
};

const WEBHOOK_URL = process.env.MOCK_WEBHOOK_URL ?? process.env.WEBHOOK_URL ?? 'http://localhost:4000/api/webhook';
const INTERVAL_MS = Number(process.env.MOCK_INTERVAL_MS ?? 2_000);
const DEAL_IDS = ['deal-acme-001', 'deal-globex-002', 'deal-initech-003', 'deal-umbrella-004'];
const STAGES = ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
const EVENT_TYPES: DealEventType[] = ['stage_changed', 'email_sent', 'meeting_booked', 'note_added'];

const args = new Set(process.argv.slice(2));
const countArg = process.argv.find(arg => arg.startsWith('--count='));
const maxEvents = countArg ? Number(countArg.split('=')[1]) : Number.POSITIVE_INFINITY;
const dryRun = args.has('--dry-run');

let sequence = 0;
let lastEvent: DealEvent | null = null;

const randomItem = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const randomId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const buildBaseEvent = (eventType: DealEventType, overrides: Partial<DealEvent> = {}): DealEvent => {
  const dealId = overrides.deal_id ?? randomItem(DEAL_IDS);

  return {
    event_id: overrides.event_id ?? randomId('evt'),
    deal_id: dealId,
    event_type: eventType,
    occurred_at: overrides.occurred_at ?? new Date().toISOString(),
    payload: {
      source: 'mock-crm',
      crmRecordVersion: sequence,
      ...buildPayload(eventType, dealId),
      ...overrides.payload,
    },
  };
};

const buildPayload = (eventType: DealEventType, dealId: string): Record<string, unknown> => {
  switch (eventType) {
    case 'stage_changed': {
      const stage = randomItem(STAGES);

      return {
        previous_stage: randomItem(STAGES),
        new_stage: stage,
        stage,
        amount: randomItem([25_000, 48_500, 75_000, 120_000]),
        close_date: minutesAgo(-randomItem([7, 14, 30, 45]) * 24 * 60),
      };
    }
    case 'email_sent':
      return {
        subject: randomItem(['Pricing follow-up', 'Security review', 'Mutual action plan', 'Contract next steps']),
        recipient: `${dealId.replaceAll('-', '.')}@example.com`,
        direction: 'outbound',
      };
    case 'meeting_booked':
      return {
        title: randomItem(['Discovery call', 'Technical validation', 'Procurement review', 'Executive alignment']),
        scheduled_at: minutesAgo(-randomItem([1, 2, 5, 10]) * 24 * 60),
        attendees: randomItem([2, 3, 5, 8]),
      };
    case 'note_added':
      return {
        note: randomItem([
          'Champion asked for ROI proof points.',
          'Legal needs DPA review before signature.',
          'Budget owner changed this week.',
          'Competitor mentioned during call.',
        ]),
        author: randomItem(['rep-a', 'rep-b', 'manager-a']),
      };
  }
};

const scenarios: Scenario[] = [
  {
    label: 'normal_event',
    build: () => buildBaseEvent(randomItem(EVENT_TYPES)),
  },
  {
    label: 'duplicate_event',
    build: () => {
      if (!lastEvent) {
        return buildBaseEvent(randomItem(EVENT_TYPES));
      }

      return {
        ...lastEvent,
        payload: {
          ...lastEvent.payload,
          duplicateReplay: true,
          replayedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    label: 'missing_activity_history',
    build: () =>
      buildBaseEvent(randomItem(['email_sent', 'meeting_booked', 'note_added']), {
        deal_id: randomId('deal-no-history'),
        payload: {
          history_gap: true,
          warning: 'Generated without earlier CRM activity history',
        },
      }),
  },
  {
    label: 'source_of_truth_conflict',
    build: () => {
      const dealId = randomItem(DEAL_IDS);
      const conflictingStage = randomItem(['DISCOVERY', 'NEGOTIATION', 'CLOSED_LOST']);

      return buildBaseEvent('stage_changed', {
        deal_id: dealId,
        payload: {
          stage: conflictingStage,
          new_stage: conflictingStage,
          amount: randomItem([1, 999_999]),
          conflict: true,
          sourceOfTruth: randomItem(['crm-primary', 'salesforce-shadow', 'spreadsheet-import']),
          conflictingField: randomItem(['stage', 'amount', 'close_date']),
        },
      });
    },
  },
  {
    label: 'out_of_order_event',
    build: () =>
      buildBaseEvent(randomItem(EVENT_TYPES), {
        occurred_at: minutesAgo(randomItem([30, 90, 240, 1_440])),
        payload: {
          out_of_order: true,
          warning: 'Generated after newer events but with an older occurred_at timestamp',
        },
      }),
  },
];

const postEvent = async (event: DealEvent, label: string) => {
  if (dryRun) {
    console.log(`[mock:${label}]`, JSON.stringify(event, null, 2));
    return;
  }

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook rejected event with ${response.status}: ${body}`);
  }

  console.log(`[mock:${label}] sent ${event.event_type} ${event.event_id} for ${event.deal_id}`);
};

const generateOnce = async () => {
  sequence += 1;
  const scenario = randomItem(scenarios);
  const event = scenario.build();

  await postEvent(event, scenario.label);
  lastEvent = event;
};

const main = async () => {
  console.log(`[mock] Sending CRM events to ${WEBHOOK_URL}`);
  console.log(`[mock] Interval: ${INTERVAL_MS}ms${dryRun ? ' (dry run)' : ''}`);

  let generated = 0;

  const tick = async () => {
    try {
      await generateOnce();
      generated += 1;

      if (generated >= maxEvents) {
        process.exit(0);
      }
    } catch (error) {
      console.error('[mock] Failed to generate event', error);
    }
  };

  await tick();
  setInterval(tick, INTERVAL_MS);
};

main().catch(error => {
  console.error('[mock] Fatal error', error);
  process.exit(1);
});
