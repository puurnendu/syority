import { render } from '@react-email/render';
import * as React from 'react';
import { WorkpackRejectedEmail } from '../src/emails/WorkpackRejectedEmail';

async function test() {
  const html = await render(
    React.createElement(WorkpackRejectedEmail, {
      recipientName: 'Jane',
      workpackNumber: 'WP-1',
      workpackTitle: 'Title',
      changedBy: 'John Reviewer',
      workpackUrl: 'http://url',
    })
  );
  console.log(html);
}

test();
