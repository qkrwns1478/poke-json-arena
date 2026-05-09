import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../server.js';
import { customData } from '../data/customData.js';

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

describe('Express API 테스트', () => {
  it('GET /health 엔드포인트는 200 OK와 상태를 반환해야 합니다.', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

app.get('/api/custom-pokemon', (req, res) => res.json(customData));

describe('Express API 테스트', () => {
  it('GET /api/custom-pokemon 엔드포인트는 커스텀 포켓몬 데이터를 반환해야 합니다.', async () => {
    const response = await request(app).get('/api/custom-pokemon');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    
    expect(response.body).toEqual(customData);
    
    expect(response.body).toHaveProperty('aldina');
    expect(response.body.aldina.name).toBe('Aldina');
    expect(response.body.aldina.baseStats.hp).toBe(100);
    
    expect(response.body).toHaveProperty('mimikyumane');
    expect(response.body.mimikyumane.types).toContain('Fairy');
  });
});
