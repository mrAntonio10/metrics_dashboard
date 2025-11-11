import { NextResponse } from 'next/server';
import AWS from 'aws-sdk';

const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.warn('[AWS] Faltan AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY en variables de entorno');
}

AWS.config.update({
  region,
  accessKeyId,
  secretAccessKey,
});

export async function GET() {
  try {
    const ec2 = new AWS.EC2();

    const data = await ec2.describeInstances().promise();

    const instances =
      (data.Reservations ?? []).flatMap((reservation: AWS.EC2.Reservation) =>
        (reservation.Instances ?? []).map((instance: AWS.EC2.Instance) => ({
          instanceId: instance.InstanceId,
          type: instance.InstanceType,
          state: instance.State?.Name,
          name:
            instance.Tags?.find((tag: AWS.EC2.Tag) => tag.Key === 'Name')
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
    console.error('[AWS][EC2] Error consultando AWS:', err.message);

    return NextResponse.json(
      {
        ok: false,
        error: 'Error consultando AWS EC2. Revisa credenciales / permisos.',
      },
      { status: 500 },
    );
  }
}
