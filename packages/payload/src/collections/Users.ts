import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [
    { name: 'name', type: 'text' },
    {
      // Doc 07 §3 layer 1: the Safety Plane's band must be server-injected, so
      // it is stored on the learner rather than sent with a request. The two
      // values are the plane's register, not doc 08's four UI bands — this
      // field drives the crisis wording and the tutor's voice, and a policy
      // register with two settings is one a reviewer can hold in their head.
      name: 'gradeBand',
      type: 'select',
      options: ['young', 'older'],
      defaultValue: 'older',
      admin: { description: 'Drives tutor voice and the crisis register.' },
    },
  ],
};
