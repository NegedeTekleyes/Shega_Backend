import { Test, TestingModule } from '@nestjs/testing';
import { CompliantsController } from './compliants.controller';

describe('CompliantsController', () => {
  let controller: CompliantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompliantsController],
    }).compile();

    controller = module.get<CompliantsController>(CompliantsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
