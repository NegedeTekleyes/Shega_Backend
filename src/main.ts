import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    // Next.js development
    'http://localhost:3000',
    'http://localhost:3001',
    
    // Next.js production (replace with your actual domains)
    'https://your-nextjs-app.vercel.app',
    'https://www.yourdomain.com',
    
    // Expo development (React Native)
    'http://localhost:8081',
    'exp://localhost:8081',
    
    // Expo production
    'https://your-app.exp.host',
    
    // React Native debugger
    'http://localhost:19006',

    // Add IPv4 and IPv6 addresses
    'http://127.0.0.1:8081',
    'http://[::1]:8081',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      // Allow all localhost origins for development (IPv4 and IPv6)
      if (origin.includes('localhost') || 
          origin.includes('127.0.0.1') || 
          origin.includes('[::1]')) {
        return callback(null, true);
      }
      
      // Check against allowed origins
      if (allowedOrigins.some(allowedOrigin => 
        origin === allowedOrigin || 
        origin.startsWith(allowedOrigin)
      )) {
        return callback(null, true);
      }
      
      // Block the request
      console.log(`CORS blocked for origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'x-admin-api-key',
      'Accept', 
      'X-Requested-With',
      'X-API-Key',
      'Access-Control-Allow-Headers'
    ],
    credentials: false, // Set to true if using cookies/sessions
    maxAge: 86400, // 24 hours for preflight cache
  });

  // ✅ FIX: Bind to all network interfaces including IPv4
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Also accessible via: http://127.0.0.1:${process.env.PORT ?? 3000}`);
  console.log(`Also accessible via: http://[::1]:${process.env.PORT ?? 3000}`);
}
bootstrap();