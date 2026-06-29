import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadService {
  getFileInfo(file: Express.Multer.File) {
    return {
      path: `/uploads/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
