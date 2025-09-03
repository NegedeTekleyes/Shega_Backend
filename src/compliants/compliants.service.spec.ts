import { Test, TestingModule } from '@nestjs/testing';
import { CompliantsService } from './compliants.service';

describe('CompliantsService', () => {
  let service: CompliantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompliantsService],
    }).compile();

    service = module.get<CompliantsService>(CompliantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
