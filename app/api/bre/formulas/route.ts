/**
 * M7.6E — Formula API
 *
 * CRUD + test + validate for formula definitions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FormulaService } from '@/core/bre/FormulaService';
import { validateExpression, listBuiltInFunctions } from '@/core/bre/FormulaEngine';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // List available built-in functions
    if (action === 'functions') {
      return NextResponse.json({ functions: listBuiltInFunctions() });
    }

    // Validate an expression
    if (action === 'validate') {
      const expression = url.searchParams.get('expression') ?? '';
      const errors = validateExpression(expression);
      return NextResponse.json({ valid: errors.length === 0, errors });
    }

    // List formulas
    const formulas = await FormulaService.list(session.user.organizationId, {
      category: url.searchParams.get('category') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
    });

    return NextResponse.json({ formulas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    // Test a formula expression
    if (action === 'test') {
      const result = await FormulaService.test(
        body.expression,
        body.variables ?? {},
        { organizationId: session.user.organizationId },
        body.params,
      );
      return NextResponse.json(result);
    }

    // Activate a formula
    if (action === 'activate') {
      const formula = await FormulaService.activate(body.id, session.user.id);
      return NextResponse.json({ formula });
    }

    // Check dependencies
    if (action === 'validate_dependencies') {
      const result = await FormulaService.validateDependencies(session.user.organizationId);
      return NextResponse.json(result);
    }

    // Get version history
    if (action === 'versions') {
      const versions = await FormulaService.getVersionHistory(body.id);
      return NextResponse.json({ versions });
    }

    // Create formula
    const formula = await FormulaService.create({
      organizationId: session.user.organizationId,
      slug: body.slug,
      name: body.name,
      description: body.description,
      category: body.category,
      expression: body.expression,
      variables: body.variables,
      returnType: body.returnType,
      unit: body.unit,
      precision: body.precision,
      ownerId: session.user.id,
      createdBy: session.user.id,
    });

    return NextResponse.json({ formula }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const formula = await FormulaService.update(body.id, {
      name: body.name,
      description: body.description,
      category: body.category,
      expression: body.expression,
      variables: body.variables,
      returnType: body.returnType,
      unit: body.unit,
      precision: body.precision,
      status: body.status,
      updatedBy: session.user.id,
      changeDescription: body.changeDescription,
    });

    return NextResponse.json({ formula });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await FormulaService.delete(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
