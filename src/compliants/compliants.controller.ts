import { Body, Controller, Post, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { CompliantsService } from './compliants.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number; // Changed to number
    email: string;
    role: string;
  };
}

@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RESIDENT') // Changed to uppercase to match your Role enum
export class CompliantsController {
    constructor(private readonly complaintsService: CompliantsService) {}

    @Post()
    async create(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateComplaintDto
    ) {
        try {
            const userId = req.user.id;
            
            if (!userId) {
                throw new HttpException('User ID not found in request', HttpStatus.BAD_REQUEST);
            }

            const complaint = await this.complaintsService.create(userId, dto);
            
            return {
                success: true, 
                message: 'Complaint submitted successfully',
                data: complaint
            };
        } catch (error) {
            console.error('Error creating complaint:', error);
            
            throw new HttpException(
                error.message || 'Failed to submit report', 
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}