// src/app/api/aws/route.ts
import { NextResponse } from 'next/server';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

export const runtime = 'nodejs'; // asegura Node.js, no edge

const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export async function GET() {
  try {
    if (!accessKeyId || !secretAccessKey) {
      console.error('[AWS][EC2] Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in env');
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing AWS credentials in environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)',
        },
        { status: 500 },
      );
    }

    const ec2 = new EC2Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new DescribeInstancesCommand({});
    const data = await ec2.send(command);

    const instances =
      (data.Reservations ?? []).flatMap((reservation) =>
        (reservation.Instances ?? []).map((instance) => ({
          instanceId: instance.InstanceId,
          type: instance.InstanceType,
          state: instance.State?.Name,
          name:
            instance.Tags?.find((tag) => tag.Key === 'Name')
              ?.Value ?? null,
          launchTime: instance.LaunchTime,
          az: instance.Placement?.AvailabilityZone ?? null,
        })),
      );

    return NextResponse.json({
      ok: true,
      count: instances.length,
      instances,
    });
  } catch (error) {
    const err = error as Error;
    console.error('[AWS][EC2] Error consultando AWS:', err.message, err.stack);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Unknown AWS error',
      },
      { status: 500 },
    );
  }
}
