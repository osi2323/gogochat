import { isApiConfigured } from '@/config/env';
import { ApiError } from '@/lib/api/errors';
import { getServerApiClient } from '@/lib/api/serverClient';

export type HealthStatus = {
  available: boolean;
  message: string;
};

export const fetchApiHealth = async (): Promise<HealthStatus> => {
  if (!isApiConfigured()) {
    return {
      available: false,
      message:
        'API adresi ayarlanmadı. NEXT_PUBLIC_API_URL veya API_URL değerini ekleyin.',
    };
  }

  const client = await getServerApiClient();

  try {
    const response = await client.get<{ status?: string; message?: string }>(
      '/health',
    );

    const message =
      response.data?.message ??
      response.data?.status ??
      'API yanıt veriyor';

    return {
      available: true,
      message,
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'API isteği başarısız oldu';

    return {
      available: false,
      message,
    };
  }
};
